/* oxlint-disable typescript/unbound-method -- mocked limiter methods do not use this */
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { RateLimitHandlerPlugin } from '@orpc/ratelimit'
import { createRouterClient } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { eq, sql } from 'drizzle-orm'
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
	vi,
} from 'vite-plus/test'

import type { ORPCContext } from '@altstack/api/context'
import {
	guestReportRateLimiter,
	reportRateLimiter,
} from '@altstack/api/report-rate-limit'
import { projectRouter } from '@altstack/api/routers/project'
import { reportRouter } from '@altstack/api/routers/report'

import {
	project,
	projectReport,
	user,
	githubRepository,
} from '@altstack/db/schemas'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'

vi.mock('@altstack/api/report-rate-limit', () => {
	return {
		reportRateLimiter: { limit: vi.fn() },
		guestReportRateLimiter: { limit: vi.fn() },
	}
})
let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>
let projectId: string
let projectSlug: string
const userId = randomUUID()
const limit = {
	success: true,
	limit: 5,
	remaining: 4,
	reset: Date.now() + 600_000,
}
function context(role?: 'user' | 'admin'): ORPCContext {
	return {
		db: scope.db,
		auth: role
			? ({
					user: { id: userId, email: 'session@example.test', role },
				} as ORPCContext['auth'])
			: null,
	}
}
function client(role?: 'user' | 'admin') {
	return createRouterClient(reportRouter, { context: context(role) })
}
const input = (body: Record<string, unknown> = {}) => {
	return {
		params: { id: projectId },
		body: {
			type: 'broken_link' as const,
			email: 'guest@example.test',
			...body,
		},
	}
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
	// Migration reruns must preserve intake.
	await scope.db.insert(user).values({
		id: userId,
		name: 'Reporter',
		role: 'user',
		email: 'session@example.test',
	})
}, 60_000)
beforeEach(async () => {
	vi.mocked(reportRateLimiter.limit).mockReset().mockResolvedValue(limit)
	vi.mocked(guestReportRateLimiter.limit)
		.mockReset()
		.mockResolvedValue({ ...limit, limit: 50 })
	await scope.db.delete(project)
	projectSlug = `report-${randomUUID()}`
	const [row] = await scope.db
		.insert(project)
		.values({
			name: 'Report target',
			tagline: 'Report target tagline',
			description: 'Public description',
			logo: 'test-fixtures/logo.svg',
			slug: projectSlug,
			repositoryUrl: `https://github.com/test/${projectSlug}`,
			status: 'published',
		})
		.returning()
	projectId = row!.id
	await scope.db.insert(githubRepository).values({
		projectId,
		owner: 'test',
		repo: projectSlug,
		fetchedAt: new Date(),
	})
})
afterAll(async () => {
	await scope.close()
	await postgres.close()
})

describe('durable private report intake', () => {
	it('persists guest contact and trimmed payload, survives migration rerun, returns no private details', async () => {
		expect(
			await client().create(
				input({ message: '  broken website  ', email: ' guest@example.test ' })
			)
		).toEqual({ received: true })
		await migrate(scope.db, {
			migrationsFolder: fileURLToPath(
				new URL('../../db/src/migrations', import.meta.url)
			),
			migrationsSchema: scope.migrationsSchema,
		})
		const rows = await scope.db.select().from(projectReport)
		expect(rows).toHaveLength(1)
		expect(rows[0]).toMatchObject({
			projectId,
			userId: null,
			email: 'guest@example.test',
			type: 'broken_link',
			message: 'broken website',
		})
		expect(rows[0]?.createdAt).toBeInstanceOf(Date)
		const publicClient = createRouterClient(projectRouter, {
			context: context(),
		})
		const detail = await publicClient.getBySlug({
			params: { slug: projectSlug },
		})
		expect(JSON.stringify(detail)).not.toMatch(
			/guest@example|broken website|project_reports/
		)
		const list = await publicClient.list({ query: {} })
		expect(JSON.stringify(list)).not.toContain('guest@example.test')
	})
	it.each(['user', 'admin'] as const)(
		'derives %s identity/email from server session and ignores supplied contact',
		async (role) => {
			await client(role).create(input({ email: 'spoof@example.test' }))
			await client(role).create({
				params: { id: projectId },
				body: { type: 'outdated' },
			})
			const rows = await scope.db.select().from(projectReport)
			expect(rows).toHaveLength(2)
			for (const row of rows) {
				expect(row).toMatchObject({ email: 'session@example.test', userId })
			}
			expect(reportRateLimiter.limit).toHaveBeenCalledWith(
				`user:${userId}`,
				expect.anything()
			)
			expect(guestReportRateLimiter.limit).not.toHaveBeenCalled()
		}
	)
	it('rejects missing/invalid email, enum, identity spoofing and blank Other before persistence/quota', async () => {
		for (const body of [
			{ type: 'outdated' },
			{ type: 'outdated', email: 'invalid' },
			{ type: 'invalid', email: 'valid@example.test' },
			{ type: 'other', email: 'valid@example.test', message: ' \n ' },
			{ type: 'outdated', email: 'valid@example.test', userId },
		]) {
			await expect(
				client().create({ params: { id: projectId }, body } as Parameters<
					ReturnType<typeof client>['create']
				>[0])
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		}
		expect(await scope.db.select().from(projectReport)).toEqual([])
		expect(reportRateLimiter.limit).not.toHaveBeenCalled()
	})
	it.each(['draft', 'rejected', 'removed', 'missing'] as const)(
		'conceals %s targets for guests and admins',
		async (status) => {
			if (status === 'missing') {
				await scope.db.delete(project).where(eq(project.id, projectId))
			} else {
				await scope.db
					.update(project)
					.set({ status })
					.where(eq(project.id, projectId))
			}
			for (const role of [undefined, 'admin'] as const) {
				await expect(client(role).create(input())).rejects.toMatchObject({
					code: 'NOT_FOUND',
					message: 'Not Found. The requested resource was not found.',
				})
			}
			expect(await scope.db.select().from(projectReport)).toEqual([])
		}
	)
	it('rolls back failed persistence and conceals database errors/contact', async () => {
		await scope.db.execute(
			sql`CREATE FUNCTION reject_report() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private write failure'; END $$`
		)
		await scope.db.execute(
			sql`CREATE TRIGGER reject_report BEFORE INSERT ON project_reports FOR EACH ROW EXECUTE FUNCTION reject_report()`
		)
		try {
			await expect(client().create(input())).rejects.toMatchObject({
				code: 'INTERNAL_SERVER_ERROR',
				message:
					'Internal Server Error. This is a problem with the server that you cannot fix.',
			})
			expect(await scope.db.select().from(projectReport)).toEqual([])
		} finally {
			await scope.db.execute(sql`DROP TRIGGER reject_report ON project_reports`)
			await scope.db.execute(sql`DROP FUNCTION reject_report()`)
		}
	})
	it('enforces identity and global anonymous quotas and fails closed on Redis errors', async () => {
		vi.mocked(reportRateLimiter.limit).mockResolvedValueOnce({
			...limit,
			success: false,
			remaining: 0,
		})
		await expect(client().create(input())).rejects.toMatchObject({
			code: 'TOO_MANY_REQUESTS',
		})
		vi.mocked(guestReportRateLimiter.limit).mockResolvedValueOnce({
			...limit,
			success: false,
			remaining: 0,
		})
		await expect(client().create(input())).rejects.toMatchObject({
			code: 'TOO_MANY_REQUESTS',
		})
		vi.mocked(reportRateLimiter.limit).mockRejectedValueOnce(
			new Error('Redis offline')
		)
		await expect(client().create(input())).rejects.toThrow('Redis offline')
		expect(await scope.db.select().from(projectReport)).toEqual([])
	})

	it('enforces database constraints and cleans foreign keys without changing project data', async () => {
		const baseline = {
			projectId,
			email: 'valid@example.test',
			type: 'outdated' as const,
		}
		for (const values of [
			{ ...baseline, type: 'other' as const, message: '' },
			{ ...baseline, message: 'x'.repeat(2001) },
			{ ...baseline, email: '' },
			{ ...baseline, projectId: randomUUID() },
		]) {
			await expect(
				scope.db.insert(projectReport).values(values)
			).rejects.toThrow(/Failed query/)
		}
		const reporterId = randomUUID()
		await scope.db.insert(user).values({
			id: reporterId,
			name: 'Temporary reporter',
			role: 'user',
			email: 'temporary@example.test',
		})
		await scope.db
			.insert(projectReport)
			.values({ ...baseline, userId: reporterId })
		await scope.db.delete(user).where(eq(user.id, reporterId))
		expect((await scope.db.select().from(projectReport))[0]).toMatchObject({
			userId: null,
			email: baseline.email,
		})
		await scope.db.delete(project).where(eq(project.id, projectId))
		expect(await scope.db.select().from(projectReport)).toEqual([])
	})
	it('supports public REST/RPC writes, rate headers, and has no report read route', async () => {
		const rest = new OpenAPIHandler(
			{ report: reportRouter },
			{ plugins: [new RateLimitHandlerPlugin()] }
		)
		const response = await rest.handle(
			new Request(`http://localhost/api/projects/${projectId}/reports`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(input().body),
			}),
			{ prefix: '/api', context: context() }
		)
		expect(response.response?.status).toBe(201)
		expect(await response.response?.json()).toEqual({ received: true })
		const read = await rest.handle(
			new Request(`http://localhost/api/projects/${projectId}/reports`),
			{ prefix: '/api', context: context() }
		)
		expect(read.matched).toBe(false)
		const rpc = new RPCHandler(
			{ report: reportRouter },
			{ plugins: [new RateLimitHandlerPlugin()] }
		)
		vi.mocked(reportRateLimiter.limit).mockResolvedValueOnce({
			...limit,
			success: false,
			remaining: 0,
		})
		const denied = await rpc.handle(
			new Request('http://localhost/rpc/report/create', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ json: input() }),
			}),
			{ prefix: '/rpc', context: context() }
		)
		expect(denied.response?.status).toBe(429)
		expect(denied.response?.headers.get('Retry-After')).toBeTruthy()
	})
})
