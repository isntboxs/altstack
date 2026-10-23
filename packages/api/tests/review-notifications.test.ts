import { createRouterClient } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { fileURLToPath } from 'node:url'
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vite-plus/test'

import type { ORPCContext } from '@altstack/api/context'
import { octokit } from '@altstack/api/github'
import {
	REVIEW_EMAIL_LEASE_MS,
	REVIEW_EMAIL_MAX_ATTEMPTS,
	REVIEW_EMAIL_RETRY_WINDOW_MS,
	reviewEmailConfig,
	runReviewNotificationBatch,
} from '@altstack/api/review-notification-delivery'
import { enqueueReviewNotification } from '@altstack/api/review-notification-outbox'
import { routers } from '@altstack/api/routers'
import * as storage from '@altstack/api/storage'
import { submissionRateLimiter } from '@altstack/api/submission-rate-limit'

import {
	auditLog,
	category,
	githubRepository,
	project,
	projectCategory,
	reviewNotification,
	user,
} from '@altstack/db/schemas'
import { seedTaxonomy } from '@altstack/db/seed-taxonomy'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'

const { provider } = vi.hoisted(() => {
	return { provider: vi.fn() }
})
vi.mock('resend', () => {
	return {
		Resend: class {
			emails = { send: provider }
		},
	}
})

let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>
let submitterId: string
let adminId: string
const feedback =
	'Add setup instructions.\nKeep <script>alert("private")</script> as text & verify the demo.'
const config = {
	appUrl: 'https://altstack.example',
	from: 'AltStack <reviews@example.test>',
}
const send = vi.fn<(payload: unknown, key: string) => Promise<void>>()
let time: Date
const now = () => time
const batch = () => runReviewNotificationBatch(scope.db, { config, send, now })
const rows = () => scope.db.select().from(reviewNotification)
function client(role: 'admin' | 'user' | null) {
	const auth = role
		? ({
				user: { id: role === 'admin' ? adminId : submitterId, role },
			} as ORPCContext['auth'])
		: null
	return createRouterClient(routers, { context: { db: scope.db, auth } })
}
async function fixture(owner: string | null = submitterId) {
	const [row] = await scope.db
		.insert(project)
		.values({
			name: 'Canvas <img src=x onerror=alert(1)> & Tools',
			slug: 'open-canvas',
			repositoryUrl: 'https://github.com/example/canvas',
			submitterId: owner,
			status: 'draft',
			tagline: 'A drawing tool',
			description: 'Synthetic drawing project.',
			logo: 'projects/open-canvas/logo.png',
		})
		.returning()
	if (!row) throw new Error('Missing project fixture')
	await scope.db.insert(githubRepository).values({
		projectId: row.id,
		owner: 'example',
		repo: 'canvas',
		githubRepositoryId: 123,
		fetchedAt: new Date(),
	})
	const [leaf] = await scope.db
		.select()
		.from(category)
		.where(eq(category.slug, 'backend'))
	await scope.db
		.insert(projectCategory)
		.values({ projectId: row.id, categoryId: leaf!.id })
	return row
}
async function decide(id: string, status: 'published' | 'rejected' | 'draft') {
	return client('admin').admin.project.update({
		params: { id },
		body: {
			status,
			...(status === 'rejected' ? { rejectionReason: feedback } : {}),
		},
	})
}

beforeAll(async () => {
	postgres = await connectTestPostgres()
	scope = await postgres.createSchema()
	await migrate(scope.db, {
		migrationsFolder: fileURLToPath(
			new URL('../../db/src/migrations', import.meta.url)
		),
		migrationsSchema: scope.migrationsSchema,
	})
	await seedTaxonomy(scope.db)
	const accounts = await scope.db
		.insert(user)
		.values([
			{ name: 'Original', email: 'original@example.test', role: 'user' },
			{ name: 'Admin', email: 'admin@example.test', role: 'admin' },
		])
		.returning()
	submitterId = accounts[0]!.id
	adminId = accounts[1]!.id
	vi.spyOn(octokit.rest.repos, 'get').mockResolvedValue({
		data: {
			id: 123,
			private: false,
			owner: { login: 'example' },
			name: 'canvas',
			stargazers_count: 10,
			forks_count: 1,
		},
	} as Awaited<ReturnType<typeof octokit.rest.repos.get>>)
	vi.spyOn(storage, 'deleteFinalKeysBestEffort').mockResolvedValue(undefined)
	vi.spyOn(submissionRateLimiter, 'limit').mockResolvedValue({
		success: true,
		limit: 5,
		remaining: 4,
		reset: Date.now() + 600_000,
	})
}, 60_000)
beforeEach(async () => {
	await scope.db.delete(auditLog)
	await scope.db.delete(project)
	await scope.db
		.update(user)
		.set({ email: 'original@example.test' })
		.where(eq(user.id, submitterId))
	send.mockReset().mockResolvedValue(undefined)
	provider
		.mockReset()
		.mockResolvedValue({ data: { id: 'synthetic' }, error: null })
	// Due timestamps use PostgreSQL now(); move the controllable worker clock ahead.
	time = new Date(Date.now() + 60_000)
})
afterAll(async () => {
	vi.restoreAllMocks()
	await scope.close()
	await postgres.close()
}, 60_000)

describe('committed review events', () => {
	it('cannot dispatch uncommitted work and leaves nothing to send after rollback', async () => {
		const row = await fixture()
		await expect(
			scope.db.transaction(async (tx) => {
				const [updated] = await tx
					.update(project)
					.set({ status: 'rejected', rejectionReason: feedback })
					.where(eq(project.id, row.id))
					.returning()
				const [decision] = await tx
					.insert(auditLog)
					.values({
						action: 'project_status_changed',
						projectId: row.id,
						actorId: adminId,
					})
					.returning()
				await enqueueReviewNotification(tx, {
					eventId: decision!.id,
					fromStatus: 'draft',
					project: updated!,
				})
				expect(await batch()).toMatchObject({ claimed: 0 })
				throw new Error('synthetic rollback')
			})
		).rejects.toThrow('synthetic rollback')
		expect(await rows()).toEqual([])
		expect(send).not.toHaveBeenCalled()
	})
	it.each(['published', 'rejected'] as const)(
		'queues %s for the original stored account, and only sends after commit',
		async (status) => {
			const row = await fixture()
			const body = {
				status,
				...(status === 'rejected' ? { rejectionReason: feedback } : {}),
				submitterId: adminId,
				email: 'arbitrary@example.test',
			}
			await client('admin').admin.project.update({
				params: { id: row.id },
				body,
			})
			const [event] = await rows()
			expect(event).toMatchObject({
				recipientId: submitterId,
				projectId: row.id,
				outcome: status,
				payload: null,
				attempts: 0,
				status: 'pending',
			})
			expect(
				await scope.db.select().from(auditLog).where(eq(auditLog.id, event!.id))
			).toMatchObject([
				{
					action: 'project_status_changed',
					metadata: { fromStatus: 'draft', toStatus: status },
				},
			])
			expect(send).not.toHaveBeenCalled()
			expect(provider).not.toHaveBeenCalled()
			// A separate database connection sees both the decision and committed event.
			expect(
				(
					await scope.pool.query('SELECT status FROM projects WHERE id = $1', [
						row.id,
					])
				).rows[0]
			).toMatchObject({ status })
			expect(await batch()).toMatchObject({ sent: 1 })
			const [sent] = await rows()
			expect(sent).toMatchObject({
				status: 'sent',
				attempts: 1,
				payload: { to: 'original@example.test', from: config.from },
			})
			expect(send.mock.calls[0]![1]).toBe(`submission-review/${event!.id}`)
			expect(sent!.payload!.text).toContain(
				'https://altstack.example/submission'
			)
			expect(sent!.payload!.html).not.toContain('<img src=x')
			expect(sent!.payload!.html).not.toContain('<script>')
			const expectedText =
				status === 'rejected'
					? [feedback, 'Edit & Resubmit']
					: ['https://altstack.example/open-canvas']
			for (const value of expectedText) {
				expect(sent!.payload!.text).toContain(value)
			}
			expect(await batch()).toMatchObject({ claimed: 0 })
			expect(send).toHaveBeenCalledTimes(1)
		}
	)
	it('does not create events for content/reason edits, repeated decisions or restoration', async () => {
		const row = await fixture()
		await decide(row.id, 'rejected')
		await decide(row.id, 'rejected')
		await client('admin').admin.project.update({
			params: { id: row.id },
			body: { rejectionReason: 'Corrected feedback', name: 'Updated name' },
		})
		await decide(row.id, 'draft')
		expect(await rows()).toHaveLength(1)
		const event = (await rows())[0]!
		await scope.db.transaction((tx) =>
			enqueueReviewNotification(tx, {
				eventId: event.id,
				fromStatus: 'draft',
				project: { ...row, status: 'rejected', rejectionReason: feedback },
			})
		)
		expect(await rows()).toHaveLength(1)
	})
	it('allows a new decision identity after the existing Edit & Resubmit flow', async () => {
		const row = await fixture()
		await decide(row.id, 'rejected')
		await batch()
		const prefill = await client('user').submission.getById({
			params: { id: row.id },
		})
		await client('user').submission.resubmit({
			params: { id: row.id },
			body: {
				revision: prefill.revision,
				name: 'Corrected Canvas',
				repositoryUrl: row.repositoryUrl,
			},
		})
		expect(await rows()).toHaveLength(1)
		await decide(row.id, 'published')
		expect(await batch()).toMatchObject({ sent: 1 })
		const events = await rows()
		expect(new Set(events.map((event) => event.id)).size).toBe(2)
		expect(send).toHaveBeenCalledTimes(2)
	})
	it('skips admin-created records and accounts without a valid stored recipient', async () => {
		const row = await fixture(null)
		await decide(row.id, 'published')
		await scope.db
			.update(project)
			.set({ status: 'draft', submitterId })
			.where(eq(project.id, row.id))
		await scope.db
			.update(user)
			.set({ email: '' })
			.where(eq(user.id, submitterId))
		await decide(row.id, 'rejected')
		expect(await rows()).toEqual([])
	})
	it('keeps moderation committed while email configuration is unavailable', async () => {
		const row = await fixture()
		await decide(row.id, 'rejected')
		expect(
			await runReviewNotificationBatch(scope.db, { config: null, send })
		).toMatchObject({ skipped: true, claimed: 0 })
		expect((await rows())[0]).toMatchObject({ attempts: 0, status: 'pending' })
		expect((await scope.db.select().from(project))[0]!.status).toBe('rejected')
	})
	it('rolls back both decision and outbox on a late transaction failure', async () => {
		const row = await fixture()
		await scope.pool.query(
			"CREATE FUNCTION fail_review_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$"
		)
		await scope.pool.query(
			'CREATE TRIGGER fail_outbox AFTER INSERT ON submission_review_notifications FOR EACH ROW EXECUTE FUNCTION fail_review_outbox()'
		)
		try {
			await expect(decide(row.id, 'rejected')).rejects.toMatchObject({
				code: 'INTERNAL_SERVER_ERROR',
			})
		} finally {
			await scope.pool.query(
				'DROP TRIGGER fail_outbox ON submission_review_notifications'
			)
			await scope.pool.query('DROP FUNCTION fail_review_outbox()')
		}
		expect(await rows()).toEqual([])
		expect(await scope.db.select().from(auditLog)).toEqual([])
		expect((await scope.db.select().from(project))[0]!.status).toBe('draft')
		expect(send).not.toHaveBeenCalled()
	})
	it('queues one winning transition for concurrent moderation and rejects stale work', async () => {
		const row = await fixture()
		const result = await Promise.allSettled([
			decide(row.id, 'published'),
			decide(row.id, 'rejected'),
		])
		expect(result.filter((value) => value.status === 'fulfilled')).toHaveLength(
			1
		)
		expect(result.find((value) => value.status === 'rejected')).toMatchObject({
			reason: { code: 'CONFLICT' },
		})
		expect(await rows()).toHaveLength(1)
	})
	it('excludes private feedback, recipients and outbox from every public project projection', async () => {
		const row = await fixture()
		await decide(row.id, 'rejected')
		await batch()
		await decide(row.id, 'published')
		const detail = await client(null).project.getBySlug({
			params: { slug: row.slug },
		})
		const list = await client(null).project.list({ query: {} })
		for (const response of [detail, list]) {
			const serialized = JSON.stringify(response)
			for (const privateValue of [
				feedback,
				'original@example.test',
				'recipientId',
				'rejectionReason',
				'payload',
			]) {
				expect(serialized).not.toContain(privateValue)
			}
		}
		await expect(
			client('user').admin.project.update({
				params: { id: row.id },
				body: { status: 'rejected', rejectionReason: feedback },
			})
		).rejects.toMatchObject({ code: 'FORBIDDEN' })
	})
})

describe('durable delivery', () => {
	it('freezes HTML/text, sender and links across failures, restarts and edits', async () => {
		const row = await fixture()
		await decide(row.id, 'rejected')
		send.mockRejectedValueOnce(
			new Error('private provider original@example.test')
		)
		expect(await batch()).toMatchObject({ retry: 1 })
		const first = (await rows())[0]!
		expect(first.lastError).toBe('delivery_failed')
		expect(JSON.stringify(first)).not.toContain('private provider')
		expect(await batch()).toMatchObject({ claimed: 0 })
		await client('admin').admin.project.update({
			params: { id: row.id },
			body: {
				name: 'Changed after decision',
				rejectionReason: 'Changed later',
			},
		})
		time = first.nextAttemptAt
		expect(
			await runReviewNotificationBatch(scope.db, {
				config: { ...config, from: 'Changed <changed@example.test>' },
				send,
				now,
			})
		).toMatchObject({ sent: 1 })
		expect(send.mock.calls[1]).toEqual(send.mock.calls[0])
	})
	it('recovers a provider-accepted attempt when saving its receipt fails', async () => {
		const row = await fixture()
		await decide(row.id, 'published')
		await scope.pool.query(
			"CREATE FUNCTION fail_review_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status = 'sent' THEN RAISE EXCEPTION 'synthetic receipt failure'; END IF; RETURN NEW; END $$"
		)
		await scope.pool.query(
			'CREATE TRIGGER fail_receipt BEFORE UPDATE ON submission_review_notifications FOR EACH ROW EXECUTE FUNCTION fail_review_receipt()'
		)
		try {
			await expect(batch()).rejects.toThrow(/Failed query/)
		} finally {
			await scope.pool.query(
				'DROP TRIGGER fail_receipt ON submission_review_notifications'
			)
			await scope.pool.query('DROP FUNCTION fail_review_receipt()')
		}
		expect((await rows())[0]).toMatchObject({ status: 'pending', attempts: 1 })
		expect(await batch()).toMatchObject({ claimed: 0 })
		time = new Date(time.getTime() + REVIEW_EMAIL_LEASE_MS)
		expect(await batch()).toMatchObject({ sent: 1 })
		expect(send.mock.calls[1]).toEqual(send.mock.calls[0])
	})
	it('does not let two workers deliver the same active lease', async () => {
		const row = await fixture()
		await decide(row.id, 'rejected')
		let release!: () => void
		let started!: () => void
		const gate = new Promise<void>((resolve) => {
			release = resolve
		})
		const ready = new Promise<void>((resolve) => {
			started = resolve
		})
		send.mockImplementationOnce(async () => {
			started()
			await gate
		})
		const first = batch()
		await ready
		try {
			expect(await batch()).toMatchObject({ claimed: 0 })
			expect(send).toHaveBeenCalledTimes(1)
		} finally {
			release()
			await first
		}
	})
	it('stops at the attempt cap and never automatically replays exhausted events', async () => {
		const row = await fixture()
		await decide(row.id, 'rejected')
		send.mockRejectedValue(new Error('offline'))
		for (let attempt = 0; attempt < REVIEW_EMAIL_MAX_ATTEMPTS; attempt++) {
			await batch()
			time = (await rows())[0]!.nextAttemptAt
		}
		expect((await rows())[0]).toMatchObject({
			status: 'failed',
			attempts: 8,
			lastError: 'retry_exhausted',
		})
		expect(await batch()).toMatchObject({ claimed: 0 })
		expect(send).toHaveBeenCalledTimes(8)
	})
	it('stops before the provider idempotency expiry after a long outage', async () => {
		const row = await fixture()
		await decide(row.id, 'rejected')
		send.mockRejectedValue(new Error('offline'))
		await batch()
		time = new Date(time.getTime() + REVIEW_EMAIL_RETRY_WINDOW_MS)
		expect(await batch()).toMatchObject({ failed: 1 })
		expect(send).toHaveBeenCalledTimes(1)
	})
	it('cancels a retry if the original account email changed', async () => {
		const row = await fixture()
		await decide(row.id, 'rejected')
		send.mockRejectedValueOnce(new Error('offline'))
		await batch()
		await scope.db
			.update(user)
			.set({ email: 'changed@example.test' })
			.where(eq(user.id, submitterId))
		time = (await rows())[0]!.nextAttemptAt
		expect(await batch()).toMatchObject({ cancelled: 1 })
		expect(send).toHaveBeenCalledTimes(1)
	})
	it('cascades unsent work on account/project removal', async () => {
		const row = await fixture()
		await decide(row.id, 'rejected')
		await scope.db.delete(project).where(eq(project.id, row.id))
		expect(await batch()).toMatchObject({ claimed: 0 })
		expect(await rows()).toEqual([])
	})
	it.each(['response', 'exception'] as const)(
		'uses the Resend SDK key/deadline and sanitizes a provider %s',
		async (kind) => {
			const row = await fixture()
			await decide(row.id, 'rejected')
			if (kind === 'response') {
				provider.mockResolvedValue({
					error: { message: 'private provider response' },
				})
			} else provider.mockRejectedValue(new Error('private provider response'))
			expect(
				await runReviewNotificationBatch(scope.db, { config, now })
			).toMatchObject({ retry: 1 })
			const requestOptions = provider.mock.calls[0]![1] as {
				idempotencyKey: string
				signal: AbortSignal
			}
			expect(provider.mock.calls[0]![0]).toMatchObject({
				to: 'original@example.test',
			})
			expect(requestOptions.idempotencyKey).toBe(
				`submission-review/${(await rows())[0]!.id}`
			)
			expect(requestOptions.signal).toBeInstanceOf(AbortSignal)
			expect((await rows())[0]!.lastError).toBe('delivery_failed')
		}
	)
})

describe('trusted email origin', () => {
	const settings = {
		NODE_ENV: 'production' as const,
		CORS_ORIGINS: ['https://altstack.example'],
		EMAIL_APP_URL: 'https://altstack.example',
		RESEND_FROM_EMAIL: 'reviews@example.test',
		RESEND_API_KEY: 're_synthetic',
	}
	it('accepts only an explicit trusted HTTPS web origin in production', () => {
		expect(reviewEmailConfig(settings)).toEqual(config)
		for (const value of [
			'https://evil.example',
			'https://altstack.example/path',
			'https://user:pass@altstack.example',
			'https://altstack.example?redirect=evil',
			'javascript:alert(1)',
			'http://localhost:3010',
		]) {
			expect(
				reviewEmailConfig({ ...settings, EMAIL_APP_URL: value })
			).toBeNull()
		}
		expect(
			reviewEmailConfig({ ...settings, EMAIL_APP_URL: undefined })
		).toBeNull()
		expect(
			reviewEmailConfig({ ...settings, RESEND_API_KEY: undefined })
		).toBeNull()
		expect(
			reviewEmailConfig({
				...settings,
				NODE_ENV: 'test',
				EMAIL_APP_URL: 'http://localhost:3010',
				CORS_ORIGINS: ['http://localhost:3010'],
			})
		).not.toBeNull()
	})
})
