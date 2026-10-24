import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { createRouterClient } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { and, eq, sql } from 'drizzle-orm'
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
import { bookmarkRouter } from '@altstack/api/routers/bookmark'

import { bookmark, project, user } from '@altstack/db/schemas'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'

let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>
const ownerId = randomUUID()
const adminId = randomUUID()
function context(id: string | null = ownerId): ORPCContext {
	return {
		db: scope.db,
		auth: id
			? ({
					user: { id, role: id === adminId ? 'admin' : 'user' },
				} as ORPCContext['auth'])
			: null,
	}
}
const client = (id: string | null = ownerId) =>
	createRouterClient(bookmarkRouter, { context: context(id) })
async function fixture(
	status: typeof project.$inferInsert.status = 'published'
) {
	const suffix = randomUUID()
	const [row] = await scope.db
		.insert(project)
		.values({
			name: `Project ${suffix}`,
			slug: `bookmark-${suffix}`,
			tagline: 'Short tagline',
			description: 'Long private editorial description',
			logo: 'projects/example/logo.png',
			repositoryUrl: `https://github.com/bookmark/${suffix}`,
			status,
			submitterId: adminId,
			rejectionReason: 'Private feedback',
		})
		.returning()
	if (!row) throw new Error('Missing fixture')
	return { row, input: { params: { id: row.id } } }
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
	await scope.db.insert(user).values([
		{
			id: ownerId,
			name: 'Bookmark owner',
			email: 'owner@bookmark.test',
			role: 'user',
		},
		{ id: adminId, name: 'Admin', email: 'admin@bookmark.test', role: 'admin' },
	])
}, 60_000)
beforeEach(async () => {
	await scope.db.delete(project)
})
afterAll(async () => {
	await scope.close()
	await postgres.close()
})

describe('private bookmarks', () => {
	it('rejects every anonymous operation before touching the database', async () => {
		const anonymous = createRouterClient(bookmarkRouter, {
			context: { db: {} as ORPCContext['db'], auth: null },
		})
		const input = { params: { id: randomUUID() } }
		for (const request of [
			anonymous.list({ query: {} }),
			anonymous.get(input),
			anonymous.save(input),
			anonymous.remove(input),
		]) {
			await expect(request).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
		}
	})
	it('allows regular users and admins, keeps state private and removes only the caller bookmark', async () => {
		const { row, input } = await fixture()
		expect(await client().get(input)).toEqual({ bookmarked: false })
		await client().save(input)
		expect(await client(adminId).get(input)).toEqual({ bookmarked: false })
		expect((await client(adminId).list({ query: {} })).bookmarks).toEqual([])
		await client(adminId).remove(input)
		expect(await client().get(input)).toEqual({ bookmarked: true })
		await client(adminId).save(input)
		const listed = await client().list({ query: {} })
		expect(listed.bookmarks).toEqual([
			{
				id: row.id,
				verified: false,
				name: row.name,
				slug: row.slug,
				logo: row.logo,
				tagline: row.tagline,
			},
		])
		await client().remove(input)
		await client().remove(input)
		expect(await client().get(input)).toEqual({ bookmarked: false })
		expect(await client(adminId).get(input)).toEqual({ bookmarked: true })
		expect(await scope.db.select().from(project)).toEqual([row])
	})
	it('is persistent and idempotent under concurrent duplicate saves and removes', async () => {
		const { input } = await fixture()
		const saved = await Promise.all(
			Array.from({ length: 8 }, () => client().save(input))
		)
		expect(saved.every((result) => result.bookmarked)).toBe(true)
		expect(await scope.db.select().from(bookmark)).toHaveLength(1)
		const first = await scope.db.select().from(bookmark)
		await client().save(input)
		expect(await scope.db.select().from(bookmark)).toEqual(first)
		expect(await client().get(input)).toEqual({ bookmarked: true })
		await Promise.all(Array.from({ length: 5 }, () => client().remove(input)))
		expect((await client().list({ query: {} })).pagination.totalItems).toBe(0)
		// Overlapping save/remove is allowed to linearize in either order, then
		// an explicit desired state must reliably win without duplicate rows.
		await Promise.all([client().save(input), client().remove(input)])
		await client().remove(input)
		expect(await scope.db.select().from(bookmark)).toEqual([])
	})
	it.each(['draft', 'rejected', 'removed'] as const)(
		'conceals %s projects even from admins and supports cleanup after unpublish',
		async (status) => {
			const { row, input } = await fixture()
			await client().save(input)
			await scope.db
				.update(project)
				.set({ status })
				.where(eq(project.id, row.id))
			for (const id of [ownerId, adminId]) {
				await expect(client(id).get(input)).rejects.toMatchObject({
					code: 'NOT_FOUND',
				})
				await expect(client(id).save(input)).rejects.toMatchObject({
					code: 'NOT_FOUND',
				})
				expect(await client(id).list({ query: {} })).toMatchObject({
					bookmarks: [],
					pagination: { totalItems: 0 },
				})
			}
			await scope.db
				.update(project)
				.set({ status: 'published' })
				.where(eq(project.id, row.id))
			expect(await client().get(input)).toEqual({ bookmarked: true })
			await scope.db
				.update(project)
				.set({ status })
				.where(eq(project.id, row.id))
			expect(await client().remove(input)).toEqual({ bookmarked: false })
			expect(await scope.db.select().from(bookmark)).toEqual([])
		}
	)
	it('conceals missing/deleted IDs and cascades project deletion', async () => {
		const { row, input } = await fixture()
		await client().save(input)
		await scope.db.delete(project).where(eq(project.id, row.id))
		for (const id of [row.id, randomUUID()]) {
			const missing = { params: { id } }
			await expect(client().get(missing)).rejects.toMatchObject({
				code: 'NOT_FOUND',
			})
			await expect(client().save(missing)).rejects.toMatchObject({
				code: 'NOT_FOUND',
			})
			expect(await client().remove(missing)).toEqual({ bookmarked: false })
		}
		expect(await scope.db.select().from(bookmark)).toEqual([])
	})
	it('paginates newest first with a stable tie breaker and counts only visible owned bookmarks', async () => {
		for (let index = 0; index < 4; index++) {
			const { input } = await fixture()
			await client().save(input)
		}
		await scope.db.update(bookmark).set({ createdAt: new Date('2026-01-01') })
		const hidden = await fixture('draft')
		await scope.db
			.insert(bookmark)
			.values({ userId: ownerId, projectId: hidden.row.id })
		const foreign = await fixture()
		await client(adminId).save(foreign.input)
		const all = await client().list({ query: {} })
		const first = await client().list({ query: { limit: 2 } })
		const second = await client().list({ query: { limit: 2, page: 2 } })
		expect([...first.bookmarks, ...second.bookmarks]).toEqual(all.bookmarks)
		expect(all.bookmarks.map((row) => row.id)).toEqual(
			all.bookmarks
				.map((row) => row.id)
				.toSorted()
				.toReversed()
		)
		expect(first.pagination).toMatchObject({
			totalItems: 4,
			totalPages: 2,
			hasNextPage: true,
			hasPreviousPage: false,
		})
		expect(second.pagination).toMatchObject({
			hasNextPage: false,
			hasPreviousPage: true,
		})
		expect((await client().list({ query: { page: 10 } })).bookmarks).toEqual([])
	})
	it('waits for an in-flight unpublish and rechecks published visibility', async () => {
		const { row, input } = await fixture()
		const connection = await scope.pool.connect()
		try {
			await connection.query('BEGIN')
			await connection.query('UPDATE projects SET status = $1 WHERE id = $2', [
				'removed',
				row.id,
			])
			const saving = client()
				.save(input)
				.then(
					() => null,
					(error: unknown) => error
				)
			await connection.query('COMMIT')
			expect(await saving).toMatchObject({ code: 'NOT_FOUND' })
			expect(await scope.db.select().from(bookmark)).toEqual([])
		} finally {
			await connection.query('ROLLBACK')
			connection.release()
		}
	})
	it('enforces validation and ownership through RPC and OpenAPI transports', async () => {
		const { row, input } = await fixture()
		const rpc = new RPCHandler({ bookmark: bookmarkRouter })
		const rest = new OpenAPIHandler({ bookmark: bookmarkRouter })
		const request = async (
			method: string,
			path: string,
			account: string | null = ownerId
		) => {
			const result = await rest.handle(
				new Request(`http://localhost/api${path}`, { method }),
				{ prefix: '/api', context: context(account) }
			)
			return result.response!
		}
		expect((await request('PUT', `/bookmarks/${row.id}`, null)).status).toBe(
			401
		)
		expect((await request('PUT', `/bookmarks/${row.id}`)).status).toBe(200)
		expect(
			await (await request('QUERY', `/bookmarks/${row.id}`)).json()
		).toEqual({ bookmarked: true })
		expect((await request('QUERY', '/bookmarks?limit=0')).status).toBe(400)
		expect(
			(await request('QUERY', `/bookmarks?userId=${adminId}`)).status
		).toBe(400)
		await client(adminId).save(input)
		const spoofed = await rpc.handle(
			new Request('http://localhost/rpc/bookmark/remove', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ json: { ...input, userId: adminId } }),
			}),
			{ prefix: '/rpc', context: context() }
		)
		expect(spoofed.response?.status).toBe(200)
		// Unrecognized transport fields cannot select another account.
		expect(await client().get(input)).toEqual({ bookmarked: false })
		expect(await client(adminId).get(input)).toEqual({ bookmarked: true })
		await client().save(input)
		expect(
			(await request('DELETE', `/bookmarks/${row.id}`, adminId)).status
		).toBe(200)
		expect(await client().get(input)).toEqual({ bookmarked: true })
		expect((await request('DELETE', `/bookmarks/${row.id}`)).status).toBe(200)
		expect(
			await scope.db
				.select()
				.from(bookmark)
				.where(
					and(eq(bookmark.userId, ownerId), eq(bookmark.projectId, row.id))
				)
		).toEqual([])
		expect(
			(await scope.db.execute(sql`SELECT count(*) FROM projects`)).rows[0]
		).toMatchObject({ count: '1' })
	})
})
