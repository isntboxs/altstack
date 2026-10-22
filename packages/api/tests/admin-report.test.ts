import { OpenAPIHandler } from '@orpc/openapi/fetch'
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
} from 'vite-plus/test'

import type { ORPCContext } from '@altstack/api/context'
import { adminReportRouter } from '@altstack/api/routers/admin-report'
import { projectRouter } from '@altstack/api/routers/project'

import { githubRepository, project, projectReport } from '@altstack/db/schemas'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'

let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>
let projectId: string
function context(role?: 'user' | 'admin'): ORPCContext {
	return {
		db: scope.db,
		auth: role
			? ({ user: { id: randomUUID(), role } } as ORPCContext['auth'])
			: null,
	}
}
const client = (role: 'user' | 'admin' = 'admin') =>
	createRouterClient(adminReportRouter, { context: context(role) })
async function report(values: Partial<typeof projectReport.$inferInsert> = {}) {
	const [row] = await scope.db
		.insert(projectReport)
		.values({
			projectId,
			email: 'guest-private@example.test',
			type: 'other',
			message: 'Private correction <script>alert(1)</script>',
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
	const [row] = await scope.db
		.insert(project)
		.values({
			name: 'Correction target',
			slug: 'correction-target',
			repositoryUrl: 'https://github.com/test/correction-target',
			status: 'published',
			tagline: 'Public tagline',
			description: 'Public description',
			logo: 'test-fixtures/logo.svg',
		})
		.returning()
	projectId = row!.id
	await scope.db.insert(githubRepository).values({
		projectId,
		owner: 'test',
		repo: 'correction-target',
		fetchedAt: new Date(),
	})
})
afterAll(async () => {
	await scope.close()
	await postgres.close()
})

describe('admin private report inbox', () => {
	it.each([undefined, 'user'] as const)(
		'rejects %s reads and decisions before accessing storage over RPC and REST',
		async (role) => {
			const row = await report()
			const expected = role ? 403 : 401
			const dbAccess = new Proxy(scope.db, {
				get() {
					throw new Error('Unauthorized database access')
				},
			})
			const ctx = { ...context(role), db: dbAccess }
			const rest = new OpenAPIHandler({ admin: { report: adminReportRouter } })
			const rpc = new RPCHandler({ admin: { report: adminReportRouter } })
			for (const operation of ['list', 'moderate'] as const) {
				const input =
					operation === 'list'
						? { query: {} }
						: { params: { id: row.id }, body: { status: 'resolved' } }
				const response = await rpc.handle(
					new Request(`http://localhost/rpc/admin/report/${operation}`, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ json: input }),
					}),
					{ prefix: '/rpc', context: ctx }
				)
				expect(response.response?.status).toBe(expected)
				const read = operation === 'list'
				const result = await rest.handle(
					new Request(
						`http://localhost/api/admin/reports${read ? '' : `/${row.id}`}`,
						{
							method: read ? 'QUERY' : 'PATCH',
							headers: { 'content-type': 'application/json' },
							...(read ? {} : { body: JSON.stringify(input.body) }),
						}
					),
					{ prefix: '/api', context: ctx }
				)
				expect(result.response?.status).toBe(expected)
				expect(await result.response?.text()).not.toMatch(
					/guest-private|Private correction/
				)
			}
			expect((await scope.db.select().from(projectReport))[0]?.status).toBe(
				'open'
			)
		}
	)
	it('defaults to Open and includes private guest contact plus all project visibility states', async () => {
		const row = await report()
		await report({ status: 'resolved' })
		await report({ status: 'dismissed' })
		for (const status of [
			'published',
			'draft',
			'rejected',
			'removed',
		] as const) {
			await scope.db
				.update(project)
				.set({
					status,
					rejectionReason: status === 'rejected' ? 'Test reason' : null,
				})
				.where(eq(project.id, projectId))
			const data = await client().list({ query: {} })
			expect(data.reports).toHaveLength(1)
			expect(data.reports[0]).toMatchObject({
				id: row.id,
				email: row.email,
				message: row.message,
				status: 'open',
				project: { id: projectId, status },
			})
		}
		for (const status of ['resolved', 'dismissed', 'all'] as const) {
			const data = await client().list({ query: { status } })
			expect(data.reports).toHaveLength(status === 'all' ? 3 : 1)
		}
	})
	it('retains and moderates reports after their project is deleted, without an edit target', async () => {
		const row = await report()
		await scope.db.delete(project).where(eq(project.id, projectId))
		const data = await client().list({ query: {} })
		expect(data.reports[0]).toMatchObject({
			id: row.id,
			email: row.email,
			message: row.message,
			project: null,
		})
		expect(
			await client().moderate({
				params: { id: row.id },
				body: { status: 'dismissed' },
			})
		).toEqual({ id: row.id, status: 'dismissed' })
	})
	it('pages deterministically through equal and sub-millisecond timestamps after inserts and moderation', async () => {
		const ids = Array.from({ length: 5 }, () => randomUUID())
			.toSorted()
			.toReversed()
		for (const id of ids) await report({ id })
		await scope.db.execute(
			sql`UPDATE ${projectReport} SET created_at = '2026-10-21 10:00:00.123456'::timestamp`
		)
		const first = await client().list({ query: { limit: 2 } })
		expect(first.reports.map((row) => row.id)).toEqual(ids.slice(0, 2))
		expect(first.nextCursor).toBe(ids[1])
		await client().moderate({
			params: { id: first.nextCursor! },
			body: { status: 'resolved' },
		})
		await report({ createdAt: new Date('2026-10-22T00:00:00Z') })
		const second = await client().list({
			query: { limit: 2, cursor: first.nextCursor! },
		})
		expect(second.reports.map((row) => row.id)).toEqual(ids.slice(2, 4))
		const last = await client().list({
			query: { limit: 2, cursor: second.nextCursor! },
		})
		expect(last.reports.map((row) => row.id)).toEqual(ids.slice(4))
		expect(last.nextCursor).toBeNull()
		await expect(
			client().list({ query: { cursor: randomUUID() } })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
	})
	it('bounds page size and rejects invalid filters, cursors and moderation payloads', async () => {
		const row = await report()
		for (const query of [
			{ limit: 0 },
			{ limit: 51 },
			{ limit: 1.5 },
			{ status: 'pending' },
			{ cursor: 'invalid' },
		]) {
			await expect(
				client().list({ query } as Parameters<
					ReturnType<typeof client>['list']
				>[0])
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		}
		for (const body of [
			{ status: 'open' },
			{ status: 'invalid' },
			{},
			{ status: 'resolved', email: 'spoof@example.test' },
		]) {
			await expect(
				client().moderate({ params: { id: row.id }, body } as Parameters<
					ReturnType<typeof client>['moderate']
				>[0])
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		}
		await expect(
			client().moderate({
				params: { id: 'invalid' },
				body: { status: 'resolved' },
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		await expect(
			client().moderate({
				params: { id: randomUUID() },
				body: { status: 'resolved' },
			})
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		expect((await scope.db.select().from(projectReport))[0]?.status).toBe(
			'open'
		)
	})
	it.each(['resolved', 'dismissed'] as const)(
		'only changes Open to %s, leaving project content and visibility intact',
		async (status) => {
			const row = await report()
			const projects = await scope.db.select().from(project)
			await client().moderate({ params: { id: row.id }, body: { status } })
			for (const next of ['resolved', 'dismissed'] as const) {
				await expect(
					client().moderate({ params: { id: row.id }, body: { status: next } })
				).rejects.toMatchObject({ code: 'CONFLICT' })
			}
			expect(await scope.db.select().from(project)).toEqual(projects)
			expect((await client().list({ query: {} })).reports).toEqual([])
			expect((await client().list({ query: { status } })).reports[0]?.id).toBe(
				row.id
			)
		}
	)
	it('allows exactly one concurrent admin decision', async () => {
		const row = await report()
		const results = await Promise.allSettled(
			['resolved', 'dismissed'].map((status) =>
				client().moderate({
					params: { id: row.id },
					body: { status: status as 'resolved' | 'dismissed' },
				})
			)
		)
		expect(
			results.filter((result) => result.status === 'fulfilled')
		).toHaveLength(1)
		expect(
			results.find((result) => result.status === 'rejected')
		).toMatchObject({ reason: { code: 'CONFLICT' } })
	})
	it('exposes admin REST contracts while keeping public project reads free of report details', async () => {
		const row = await report()
		const rest = new OpenAPIHandler({ admin: { report: adminReportRouter } })
		const listed = await rest.handle(
			new Request('http://localhost/api/admin/reports?status=all&limit=1', {
				method: 'QUERY',
			}),
			{ prefix: '/api', context: context('admin') }
		)
		expect(listed.response?.status).toBe(200)
		expect(await listed.response?.json()).toMatchObject({
			reports: [{ id: row.id, email: row.email }],
		})
		const moderated = await rest.handle(
			new Request(`http://localhost/api/admin/reports/${row.id}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ status: 'resolved' }),
			}),
			{ prefix: '/api', context: context('admin') }
		)
		expect(moderated.response?.status).toBe(200)
		for (const role of [undefined, 'user', 'admin'] as const) {
			const publicClient = createRouterClient(projectRouter, {
				context: context(role),
			})
			const detail = await publicClient.getBySlug({
				params: { slug: 'correction-target' },
			})
			const list = await publicClient.list({ query: {} })
			for (const data of [detail, list]) {
				expect(JSON.stringify(data)).not.toMatch(
					/guest-private|Private correction|reporter|project_reports/
				)
			}
		}
	})
})
