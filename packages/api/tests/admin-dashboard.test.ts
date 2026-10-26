import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { createRouterClient } from '@orpc/server'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from 'vite-plus/test'

import type { ORPCContext } from '@altstack/api/context'
import { adminDashboardRouter } from '@altstack/api/routers/admin-dashboard'
import { adminProjectRouter } from '@altstack/api/routers/admin-project'
import { adminReportRouter } from '@altstack/api/routers/admin-report'
import { ownershipRouter } from '@altstack/api/routers/ownership'

import {
	auditLog,
	githubRepository,
	project,
	projectClaim,
	projectMember,
	projectReport,
	reviewNotification,
	user,
} from '@altstack/db/schemas'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'

let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>
let adminId: string
let userId: string
const context = (role: string | null = 'admin', id = adminId): ORPCContext => {
	return {
		db: scope.db,
		auth: role ? ({ user: { id, role } } as ORPCContext['auth']) : null,
	}
}
const client = () =>
	createRouterClient(adminDashboardRouter, { context: context() })
async function addProject(
	values: Partial<typeof project.$inferInsert> = {},
	fetchedAt?: Date
) {
	const key = randomUUID()
	const [row] = await scope.db
		.insert(project)
		.values({
			name: key,
			slug: key,
			repositoryUrl: `https://github.com/test/${key}`,
			status: 'published',
			...values,
		})
		.returning()
	if (fetchedAt) {
		await scope.db
			.insert(githubRepository)
			.values({ projectId: row!.id, owner: 'test', repo: key, fetchedAt })
	}
	return row!
}
async function claim(
	projectId: string,
	claimantId = userId,
	values: Partial<typeof projectClaim.$inferInsert> = {}
) {
	const [row] = await scope.db
		.insert(projectClaim)
		.values({
			projectId,
			userId: claimantId,
			email: 'private-claim@example.test',
			role: 'owner',
			status: 'pending',
			challengeId: randomUUID(),
			codeExpiresAt: new Date(),
			emailVerifiedAt: new Date(),
			...values,
		})
		.returning()
	return row!
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
}, 60_000)
beforeEach(async () => {
	await scope.db.delete(projectReport)
	await scope.db.delete(project)
	await scope.db.delete(auditLog)
	await scope.db.delete(user)
	const people = await scope.db
		.insert(user)
		.values([
			{ name: 'Admin', email: 'admin@example.test', role: 'admin' },
			{
				name: 'Submitter',
				email: 'submitter-private@example.test',
				role: 'user',
			},
		])
		.returning()
	adminId = people[0]!.id
	userId = people[1]!.id
})
afterAll(async () => {
	await scope.close()
	await postgres.close()
})

describe('admin dashboard', () => {
	it.each([null, 'user', 'owner', 'maintainer'])(
		'denies %s access to every dashboard endpoint before storage',
		async (role) => {
			const denied = context(role)
			denied.db = new Proxy(scope.db, {
				get() {
					throw new Error('Unauthorized storage access')
				},
			})
			const rpc = createRouterClient(adminDashboardRouter, { context: denied })
			const code = role ? 'FORBIDDEN' : 'UNAUTHORIZED'
			await expect(rpc.overview({})).rejects.toMatchObject({ code })
			await expect(rpc.activity({ query: {} })).rejects.toMatchObject({ code })
			await expect(rpc.operations({})).rejects.toMatchObject({ code })
			const rest = new OpenAPIHandler({
				admin: { dashboard: adminDashboardRouter },
			})
			for (const path of ['dashboard', 'activity', 'operations']) {
				const result = await rest.handle(
					new Request(`http://localhost/api/admin/${path}`, {
						method: 'QUERY',
					}),
					{ prefix: '/api', context: denied }
				)
				expect(result.response?.status).toBe(role ? 403 : 401)
			}
		}
	)
	it('returns honest zero and unavailable states without fabricating history', async () => {
		const overview = await client().overview({})
		expect(overview.counts).toEqual({
			published: 0,
			needsReview: 0,
			openReports: 0,
			pendingClaims: 0,
			totalProjects: 0,
			users: 2,
		})
		expect(overview.submissions).toEqual([])
		expect(overview.statuses).toHaveLength(4)
		expect((await client().activity({ query: {} })).events).toEqual([])
		const ops = await client().operations({})
		expect(ops.github).toMatchObject({
			total: 0,
			missing: 0,
			latestFetchedAt: null,
			oldestFetchedAt: null,
			failureTelemetry: 'unavailable',
		})
		expect(ops.outbox).toEqual({
			pending: 0,
			failed: 0,
			sent: 0,
			cancelled: 0,
			due: 0,
			oldestPendingAt: null,
			lastSentAt: null,
		})
	})
	it('counts actual statuses and bounds queues, with no private evidence or email in overview', async () => {
		for (let i = 0; i < 7; i++) {
			await addProject({
				status: 'draft',
				submitterId: userId,
				createdAt: new Date(Date.UTC(2026, 0, i + 1)),
				rejectionReason: 'private feedback',
			})
			await scope.db.insert(projectReport).values({
				email: 'private-report@example.test',
				type: 'other',
				message: 'private report evidence',
				createdAt: new Date(Date.UTC(2026, 0, i + 1)),
			})
		}
		await addProject({ status: 'draft' })
		await addProject({ status: 'rejected', submitterId: userId })
		const published = await addProject()
		await claim(published.id)
		await scope.db.insert(projectReport).values({
			email: 'private@example.test',
			type: 'outdated',
			status: 'resolved',
		})
		const overview = await client().overview({})
		expect(overview.counts).toMatchObject({
			needsReview: 7,
			published: 1,
			openReports: 7,
			pendingClaims: 1,
			totalProjects: 10,
		})
		const catalog = createRouterClient(adminProjectRouter, {
			context: context(),
		})
		const publishedList = await catalog.list({ query: { status: 'published' } })
		expect(publishedList.pagination.totalItems).toBe(overview.counts.published)
		expect(publishedList.projects[0]?.github).toBeNull()
		expect(
			(await catalog.list({ query: { needsReview: true } })).pagination
				.totalItems
		).toBe(overview.counts.needsReview)
		expect(overview.submissions).toHaveLength(5)
		expect(overview.reports).toHaveLength(5)
		expect(overview.submissions[0]?.createdAt).toEqual(
			new Date('2026-01-01T00:00:00Z')
		)
		expect(JSON.stringify(overview)).not.toMatch(
			/private|codeHash|githubEvidence|rejectionReason|payload/
		)
	})
	it('matches the existing reviewable ownership inbox and preserves self, member, and banned-account restrictions', async () => {
		const unverified = await addProject()
		const eligible = await claim(unverified.id)
		await claim(unverified.id, adminId)
		const verified = await addProject()
		await scope.db
			.insert(projectMember)
			.values({ projectId: verified.id, userId, role: 'owner' })
		await claim(verified.id)
		const [banned] = await scope.db
			.insert(user)
			.values({
				name: 'Banned',
				email: 'banned@example.test',
				role: 'user',
				banned: true,
			})
			.returning()
		await claim(unverified.id, banned!.id)
		await claim((await addProject({ status: 'draft' })).id)
		await claim((await addProject()).id, userId, {
			status: 'email_pending',
			emailVerifiedAt: null,
		})
		const inbox = createRouterClient(ownershipRouter, { context: context() })
		const overview = await client().overview({})
		expect(overview.counts.pendingClaims).toBe(1)
		expect(overview.claims.map((item) => item.id)).toEqual([eligible.id])
		expect((await inbox.inbox({ query: {} })).pagination.totalItems).toBe(
			overview.counts.pendingClaims
		)
		expect(
			(await inbox.inbox({ query: { claimId: eligible.id } })).claims[0]?.id
		).toBe(eligible.id)
		expect(
			(await inbox.inbox({ query: { claimId: eligible.id, page: 2 } })).claims
		).toEqual([])
		expect(
			(
				await createRouterClient(ownershipRouter, {
					context: context('user', userId),
				}).inbox({ query: { claimId: eligible.id } })
			).claims
		).toEqual([])
	})
	it('filters and paginates real audit events deterministically with a safe metadata allowlist', async () => {
		const target = await addProject()
		const ids = [randomUUID(), randomUUID(), randomUUID()]
			.toSorted()
			.toReversed()
		for (const id of ids) {
			await scope.db.insert(auditLog).values({
				id,
				actorId: adminId,
				projectId: target.id,
				action: 'project_status_changed',
				createdAt: new Date('2026-10-20T23:59:59Z'),
				reason: 'private reason',
				metadata: {
					fromStatus: 'draft',
					toStatus: 'published',
					manualEvidence: 'private evidence',
					secret: 'private token',
				},
			})
		}
		await scope.db.insert(auditLog).values({
			action: 'user_role_changed',
			actorId: userId,
			createdAt: new Date('2026-10-21T00:00:00Z'),
			metadata: {
				userId,
				role: 'admin',
				previousRole: 'user',
				email: 'private@example.test',
			},
		})
		const filtered = {
			action: 'project_status_changed',
			actorId: adminId,
			projectId: target.id,
			from: '2026-10-20',
			to: '2026-10-20',
			limit: 2,
		} as const
		const page1 = await client().activity({ query: filtered })
		const page2 = await client().activity({ query: { ...filtered, page: 2 } })
		expect(page1.events.map((event) => event.id)).toEqual(ids.slice(0, 2))
		expect(page2.events.map((event) => event.id)).toEqual(ids.slice(2))
		expect(page1).toMatchObject({ totalItems: 3, totalPages: 2 })
		expect(page1.events[0]).toMatchObject({
			actor: { id: adminId, name: 'Admin' },
			project: { id: target.id },
			details: { fromStatus: 'draft', toStatus: 'published' },
		})
		const accountEvents = await client().activity({
			query: { from: '2026-10-21' },
		})
		expect(accountEvents.events).toHaveLength(1)
		expect(accountEvents.events[0]?.targetUser).toEqual({
			id: userId,
			name: 'Submitter',
		})
		expect(JSON.stringify([page1, accountEvents])).not.toMatch(
			/private|metadata|reason|email|token/
		)
	})
	it('measures freshness and durable outbox statuses without exposing frozen email payloads', async () => {
		const recent = new Date()
		const old = new Date(Date.now() - 72 * 3_600_000)
		const published = await addProject({}, recent)
		await addProject({}, old)
		await addProject()
		await addProject({ status: 'draft' }, old)
		for (const status of [
			'pending',
			'pending',
			'failed',
			'sent',
			'cancelled',
		] as const) {
			const [event] = await scope.db
				.insert(auditLog)
				.values({ action: 'project_status_changed', projectId: published.id })
				.returning()
			await scope.db.insert(reviewNotification).values({
				id: event!.id,
				projectId: published.id,
				recipientId: userId,
				projectName: 'private',
				projectSlug: 'private',
				outcome: 'published',
				status,
				nextAttemptAt: old,
				sentAt: status === 'sent' ? recent : null,
				payload: {
					to: 'private@example.test',
					from: 'private@example.test',
					subject: 'private',
					html: 'private',
					text: 'private',
				},
			})
		}
		const ops = await client().operations({})
		expect(ops.github).toMatchObject({
			total: 3,
			fresh: 1,
			stale: 1,
			missing: 1,
			latestFetchedAt: recent,
			oldestFetchedAt: old,
			failureTelemetry: 'unavailable',
		})
		expect(ops.outbox).toMatchObject({
			pending: 2,
			failed: 1,
			sent: 1,
			cancelled: 1,
			due: 2,
			lastSentAt: recent,
		})
		expect(JSON.stringify(ops)).not.toMatch(
			/private|payload|recipient|rejection/
		)
	})
	it('bounds inputs, validates UTC ranges, and resolves exact report deep links', async () => {
		await expect(
			client().activity({ query: { limit: 51 } })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		await expect(
			client().activity({ query: { from: '2026-10-22', to: '2026-10-21' } })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		await expect(
			client().activity({ query: { actorId: 'invalid' } })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		const [report] = await scope.db
			.insert(projectReport)
			.values({ email: 'private@example.test', type: 'outdated' })
			.returning()
		await scope.db
			.insert(projectReport)
			.values({ email: 'other@example.test', type: 'outdated' })
		const reportClient = createRouterClient(adminReportRouter, {
			context: context(),
		})
		expect(
			(
				await reportClient.list({ query: { reportId: report!.id } })
			).reports.map((row) => row.id)
		).toEqual([report!.id])
	})
})
