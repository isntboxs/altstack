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
} from 'vite-plus/test'

import type { ORPCContext } from '@altstack/api/context'
import { routers } from '@altstack/api/routers'

import { auditLog, githubRepository, project, user } from '@altstack/db/schemas'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'

let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>
let adminId: string
let submitterId: string
let ids: Array<string>
const fixtures = [
	{ name: 'Review Alpha %', status: 'draft', submitted: true },
	{ name: 'Review Beta', status: 'draft', submitted: true },
	{ name: 'Review Admin', status: 'draft', submitted: false },
	{ name: 'Review Published', status: 'published', submitted: true },
	{ name: 'Review Rejected', status: 'rejected', submitted: true },
	{ name: 'Review Removed', status: 'removed', submitted: true },
] as const

function client(role: 'admin' | 'user' | null, ownerId = submitterId) {
	const auth = role
		? ({
				user: { id: role === 'admin' ? adminId : ownerId, role },
			} as ORPCContext['auth'])
		: null
	return createRouterClient(routers, { context: { db: scope.db, auth } })
}
function history(id = ids[0]!, query = {}) {
	return client('admin').admin.project.reviewHistory({ params: { id }, query })
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
	const users = await scope.db
		.insert(user)
		.values([
			{ name: 'Reviewer', email: 'reviewer@example.test', role: 'admin' },
			{ name: 'Submitter', email: 'submitter@example.test', role: 'user' },
		])
		.returning()
	adminId = users[0]!.id
	submitterId = users[1]!.id
}, 60_000)

beforeEach(async () => {
	await scope.db.delete(auditLog)
	await scope.db.delete(project)
	const rows = await scope.db
		.insert(project)
		.values(
			fixtures.map((fixture, index) => {
				return {
					name: fixture.name,
					slug: `review-${index}`,
					repositoryUrl: `https://github.com/history/repo-${index}`,
					status: fixture.status,
					submitterId: fixture.submitted ? submitterId : null,
					createdAt: new Date('2026-01-01T00:00:00Z'),
				}
			})
		)
		.returning()
	ids = rows.map((row) => row.id)
	await scope.db.insert(githubRepository).values(
		rows.map((row, index) => {
			return {
				projectId: row.id,
				owner: 'history',
				repo: `repo-${index}`,
				fetchedAt: new Date(),
			}
		})
	)
})

afterAll(async () => {
	await scope.close()
	await postgres.close()
}, 60_000)

describe('admin Needs review', () => {
	it('includes only submitted drafts and preserves the default all-projects list', async () => {
		const admin = client('admin').admin.project
		expect((await admin.list({ query: {} })).pagination.totalItems).toBe(
			fixtures.length
		)
		const result = await admin.list({
			query: { needsReview: true, sort: 'name', order: 'asc' },
		})
		expect(result.projects.map((row) => row.id)).toEqual(ids.slice(0, 2))
		expect(result.pagination.totalItems).toBe(2)
		expect(
			(await admin.list({ query: { needsReview: 'false' } })).pagination
				.totalItems
		).toBe(fixtures.length)
	})
	it('intersects status and literal name filters and shares the predicate with counts', async () => {
		const admin = client('admin').admin.project
		const filtered = await admin.list({
			query: {
				needsReview: 'true',
				status: 'draft',
				name: 'ALPHA %',
				limit: 1,
			},
		})
		expect(filtered.projects.map((row) => row.id)).toEqual([ids[0]])
		expect(filtered.pagination.totalItems).toBe(1)
		for (const status of ['published', 'rejected', 'removed'] as const) {
			const result = await admin.list({ query: { needsReview: true, status } })
			expect(result.projects).toEqual([])
			expect(result.pagination.totalItems).toBe(0)
		}
	})
	it('sorts and paginates filtered drafts with stable counts, including an empty later page', async () => {
		const pages = await Promise.all(
			[1, 2, 3].map((page) =>
				client('admin').admin.project.list({
					query: {
						needsReview: true,
						name: 'review',
						page,
						limit: 1,
						sort: 'name',
						order: 'asc',
					},
				})
			)
		)
		expect(pages.flatMap((page) => page.projects.map((row) => row.id))).toEqual(
			ids.slice(0, 2)
		)
		for (const page of pages) {
			expect(page.pagination).toMatchObject({ totalItems: 2, totalPages: 2 })
		}
		expect(pages[0]?.pagination.hasNextPage).toBe(true)
		expect(pages[1]?.pagination.hasPreviousPage).toBe(true)
		expect(pages[2]?.projects).toEqual([])
	})
	it('includes restored submitted drafts and excludes drafts whose submitter was deleted', async () => {
		await client('admin').admin.project.update({
			params: { id: ids[4]! },
			body: { status: 'draft' },
		})
		const restored = await client('admin').admin.project.list({
			query: { needsReview: true },
		})
		expect(restored.projects.map((row) => row.id).toSorted()).toEqual(
			[ids[0]!, ids[1]!, ids[4]!].toSorted()
		)
		const [deleted] = await scope.db
			.insert(user)
			.values({
				name: 'Deleted submitter',
				email: 'deleted-submitter@example.test',
				role: 'user',
			})
			.returning()
		await scope.db
			.update(project)
			.set({ submitterId: deleted!.id })
			.where(eq(project.id, ids[0]!))
		await scope.db.delete(user).where(eq(user.id, deleted!.id))
		const result = await client('admin').admin.project.list({
			query: { needsReview: true },
		})
		expect(result.projects.map((row) => row.id).toSorted()).toEqual(
			[ids[1]!, ids[4]!].toSorted()
		)
	})
})

describe('admin project review history', () => {
	it('returns empty history without fabricating creation or submission events', async () => {
		expect(await history()).toEqual({
			events: [],
			pagination: {
				page: 1,
				limit: 20,
				totalItems: 0,
				totalPages: 0,
				hasNextPage: false,
				hasPreviousPage: false,
			},
		})
	})
	it('requires admin even for the project owner and does not expose history on public or owner routers', async () => {
		for (const [role, owner, code] of [
			[null, submitterId, 'UNAUTHORIZED'],
			['user', submitterId, 'FORBIDDEN'],
			['user', adminId, 'FORBIDDEN'],
		] as const) {
			await expect(
				client(role, owner).admin.project.reviewHistory({
					params: { id: ids[0]! },
					query: {},
				})
			).rejects.toMatchObject({ code })
		}
		expect(routers.project).not.toHaveProperty('reviewHistory')
		expect(routers.submission).not.toHaveProperty('reviewHistory')
	})
	it('returns NOT_FOUND for a missing project and rejects invalid inputs', async () => {
		await expect(history(crypto.randomUUID())).rejects.toMatchObject({
			code: 'NOT_FOUND',
		})
		await expect(history('not-a-uuid')).rejects.toMatchObject({
			code: 'BAD_REQUEST',
		})
		await expect(history(ids[0], { limit: 51 })).rejects.toMatchObject({
			code: 'BAD_REQUEST',
		})
	})
	it('returns only review events scoped to this project, minimal actors, transitions and rejection reasons', async () => {
		await scope.db.insert(auditLog).values([
			{
				actorId: adminId,
				projectId: ids[0],
				action: 'project_created',
				metadata: { status: 'draft', privateField: 'omit' },
			},
			{
				actorId: submitterId,
				projectId: ids[0],
				action: 'project_submitted',
				metadata: { status: 'published' },
			},
			{
				actorId: adminId,
				projectId: ids[0],
				action: 'project_status_changed',
				metadata: { fromStatus: 'draft', toStatus: 'rejected' },
				reason: 'Needs a clearer README',
			},
			{ actorId: adminId, projectId: ids[0], action: 'project_updated' },
			{ actorId: adminId, projectId: ids[0], action: 'project_removed' },
			{ actorId: adminId, projectId: ids[1], action: 'project_created' },
		])
		const result = await history()
		expect(result.pagination.totalItems).toBe(3)
		expect(result.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					action: 'project_created',
					actor: { id: adminId, name: 'Reviewer' },
					fromStatus: null,
					toStatus: 'draft',
				}),
				expect.objectContaining({
					action: 'project_submitted',
					actor: { id: submitterId, name: 'Submitter' },
					fromStatus: null,
					toStatus: 'draft',
				}),
				expect.objectContaining({
					action: 'project_status_changed',
					reason: 'Needs a clearer README',
					fromStatus: 'draft',
					toStatus: 'rejected',
				}),
			])
		)
		for (const event of result.events) {
			expect(Object.keys(event).toSorted()).toEqual(
				[
					'id',
					'action',
					'createdAt',
					'actor',
					'reason',
					'fromStatus',
					'toStatus',
				].toSorted()
			)
			expect(event.createdAt).toBeInstanceOf(Date)
		}
	})
	it('tolerates null and deleted actors while retaining their events', async () => {
		const [deleted] = await scope.db
			.insert(user)
			.values({
				name: 'Deleted reviewer',
				email: 'deleted-reviewer@example.test',
				role: 'admin',
			})
			.returning()
		await scope.db.insert(auditLog).values([
			{ actorId: null, projectId: ids[0], action: 'project_created' },
			{
				actorId: deleted!.id,
				projectId: ids[0],
				action: 'project_status_changed',
				reason: 'Still visible',
			},
		])
		await scope.db.delete(user).where(eq(user.id, deleted!.id))
		const result = await history()
		expect(result.events).toHaveLength(2)
		expect(result.events.every((event) => event.actor === null)).toBe(true)
		expect(
			result.events.some((event) => event.reason === 'Still visible')
		).toBe(true)
	})
	it.each([
		null,
		{},
		[],
		'malformed JSON {',
		42,
		{ fromStatus: 'pending', toStatus: { value: 'draft' } },
	])(
		'tolerates malformed or absent metadata %j without inventing statuses',
		async (metadata) => {
			await scope.db.insert(auditLog).values([
				{ projectId: ids[0], action: 'project_created', metadata },
				{ projectId: ids[0], action: 'project_status_changed', metadata },
				{ projectId: ids[0], action: 'project_submitted', metadata },
			])
			const result = await history()
			for (const event of result.events) {
				expect(event.fromStatus).toBeNull()
				expect(event.toStatus).toBe(
					event.action === 'project_submitted' ? 'draft' : null
				)
			}
		}
	)
	it('validates transition fields independently and uses only creation metadata.status', async () => {
		await scope.db.insert(auditLog).values([
			{
				projectId: ids[0],
				action: 'project_status_changed',
				metadata: { fromStatus: 'draft', toStatus: 'invalid' },
			},
			{
				projectId: ids[0],
				action: 'project_status_changed',
				metadata: { fromStatus: false, toStatus: 'published' },
			},
			{
				projectId: ids[0],
				action: 'project_created',
				metadata: {
					status: 'removed',
					fromStatus: 'draft',
					toStatus: 'published',
				},
			},
		])
		expect((await history()).events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					action: 'project_status_changed',
					fromStatus: 'draft',
					toStatus: null,
				}),
				expect.objectContaining({
					action: 'project_status_changed',
					fromStatus: null,
					toStatus: 'published',
				}),
				expect.objectContaining({
					action: 'project_created',
					fromStatus: null,
					toStatus: 'removed',
				}),
			])
		)
	})
	it('orders newest-first by timestamp and ID, preserves duplicate-looking rows and shares counts across pages', async () => {
		const rows = await scope.db
			.insert(auditLog)
			.values(
				Array.from({ length: 23 }, (_, index) => {
					return {
						id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
						projectId: ids[0],
						action: 'project_status_changed' as const,
						createdAt: new Date(
							index === 0 ? '2026-02-02T00:00:00Z' : '2026-02-01T00:00:00Z'
						),
						metadata: { fromStatus: 'draft', toStatus: 'rejected' },
						reason: 'Duplicate-looking real event',
					}
				})
			)
			.returning()
		const first = await history()
		const second = await history(ids[0], { page: 2 })
		const expected = rows
			.toSorted(
				(a, b) =>
					b.createdAt.getTime() - a.createdAt.getTime() ||
					b.id.localeCompare(a.id)
			)
			.map((row) => row.id)
		expect(
			[...first.events, ...second.events].map((event) => event.id)
		).toEqual(expected)
		expect(first.events).toHaveLength(20)
		expect(second.events).toHaveLength(3)
		expect(first.pagination).toMatchObject({
			totalItems: 23,
			totalPages: 2,
			hasNextPage: true,
		})
		expect(second.pagination).toMatchObject({
			totalItems: 23,
			hasNextPage: false,
			hasPreviousPage: true,
		})
		expect((await history(ids[0], { page: 3 })).events).toEqual([])
	})
	it('shows real reject and restore mutations immediately, excluding routine saves', async () => {
		const admin = client('admin').admin.project
		const params = { id: ids[0]! }
		await admin.update({
			params,
			body: { status: 'rejected', rejectionReason: '  Needs documentation  ' },
		})
		await admin.update({ params, body: { status: 'draft' } })
		await admin.update({ params, body: { name: 'Edited name' } })
		const result = await history()
		expect(result.pagination.totalItems).toBe(2)
		expect(result.events).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					fromStatus: 'draft',
					toStatus: 'rejected',
					reason: 'Needs documentation',
				}),
				expect.objectContaining({
					fromStatus: 'rejected',
					toStatus: 'draft',
					reason: null,
				}),
			])
		)
	})
})
