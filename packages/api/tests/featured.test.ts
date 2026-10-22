import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { createRouterClient } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { asc, eq } from 'drizzle-orm'
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
import { adminFeaturedRouter } from '@altstack/api/routers/admin-featured'
import { projectRouter } from '@altstack/api/routers/project'

import {
	featuredProject,
	githubRepository,
	project,
} from '@altstack/db/schemas'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'

let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>
function context(role?: 'user' | 'admin'): ORPCContext {
	return {
		db: scope.db,
		auth: role
			? ({ user: { id: randomUUID(), role } } as ORPCContext['auth'])
			: null,
	}
}
const client = () =>
	createRouterClient(adminFeaturedRouter, { context: context('admin') })
const publicClient = () =>
	createRouterClient(projectRouter, { context: context() })
async function fixture(
	slug: string,
	overrides: Partial<typeof project.$inferInsert> = {}
) {
	const [row] = await scope.db
		.insert(project)
		.values({
			name: slug,
			slug,
			repositoryUrl: `https://github.com/fixtures/${slug}`,
			websiteUrl: `https://${slug}.example.test`,
			status: 'published',
			tagline: 'Public tagline',
			description: 'Public description',
			logo: 'test-fixtures/logo.svg',
			...overrides,
		})
		.returning()
	await scope.db.insert(githubRepository).values({
		projectId: row!.id,
		owner: 'fixtures',
		repo: slug,
		stars: 12,
		forks: 3,
		fetchedAt: new Date(),
	})
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
	await scope.db.delete(project)
})
afterAll(async () => {
	await scope.close()
	await postgres.close()
})

describe('global featured project curation', () => {
	it.each([undefined, 'user'] as const)(
		'rejects %s reads and writes before DB access over RPC and REST',
		async (role) => {
			const forbiddenDb = new Proxy(scope.db, {
				get() {
					throw new Error('Unauthorized database access')
				},
			})
			const ctx = { ...context(role), db: forbiddenDb }
			const rest = new OpenAPIHandler({
				admin: { featured: adminFeaturedRouter },
			})
			const rpc = new RPCHandler({ admin: { featured: adminFeaturedRouter } })
			for (const name of ['list', 'update'] as const) {
				const body = { projectIds: [], expectedProjectIds: [] }
				const result = await rest.handle(
					new Request('http://localhost/api/admin/featured-projects', {
						method: name === 'list' ? 'QUERY' : 'PUT',
						headers: { 'content-type': 'application/json' },
						...(name === 'update' ? { body: JSON.stringify(body) } : {}),
					}),
					{ prefix: '/api', context: ctx }
				)
				expect(result.response?.status).toBe(role ? 403 : 401)
				const call = await rpc.handle(
					new Request(`http://localhost/rpc/admin/featured/${name}`, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ json: name === 'list' ? {} : { body } }),
					}),
					{ prefix: '/rpc', context: ctx }
				)
				expect(call.response?.status).toBe(role ? 403 : 401)
			}
		}
	)
	it('saves, orders, removes and clears without changing catalogue order or project timestamps', async () => {
		const a = await fixture('alpha'),
			b = await fixture('beta')
		const before = await scope.db
			.select()
			.from(project)
			.orderBy(asc(project.id))
		expect(await client().list({})).toEqual({ projects: [] })
		const saved = await client().update({
			body: { projectIds: [b.id, a.id], expectedProjectIds: [] },
		})
		expect(saved.projects.map(({ id }) => id)).toEqual([b.id, a.id])
		expect((await client().list({})).projects.map(({ id }) => id)).toEqual([
			b.id,
			a.id,
		])
		await client().update({
			body: { projectIds: [a.id], expectedProjectIds: [b.id, a.id] },
		})
		await client().update({
			body: { projectIds: [], expectedProjectIds: [a.id] },
		})
		expect(await scope.db.select().from(featuredProject)).toEqual([])
		expect(
			await scope.db.select().from(project).orderBy(asc(project.id))
		).toEqual(before)
	})
	it('requires unique bounded IDs, published status, repository data and safe websites atomically', async () => {
		const valid = await fixture('valid')
		await client().update({
			body: { projectIds: [valid.id], expectedProjectIds: [] },
		})
		const invalid = [
			await fixture('draft', { status: 'draft' }),
			await fixture('rejected', {
				status: 'rejected',
				rejectionReason: 'Review',
			}),
			await fixture('removed', { status: 'removed' }),
			await fixture('no-website', { websiteUrl: null }),
			await fixture('unsafe', { websiteUrl: 'javascript:alert(1)' }),
			await fixture('credentials', {
				websiteUrl: 'https://user:password@example.test',
			}),
			await fixture('no-repository'),
		]
		await scope.db
			.delete(githubRepository)
			.where(eq(githubRepository.projectId, invalid.at(-1)!.id))
		for (const ids of [
			[valid.id, valid.id],
			Array.from({ length: 22 }, () => randomUUID()),
			[randomUUID()],
			...invalid.map(({ id }) => [id]),
		]) {
			await expect(
				client().update({
					body: { projectIds: ids, expectedProjectIds: [valid.id] },
				})
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
			expect((await client().list({})).projects.map(({ id }) => id)).toEqual([
				valid.id,
			])
		}
	})
	it('rejects stale/concurrent saves, including two initial empty selections', async () => {
		const a = await fixture('alpha'),
			b = await fixture('beta')
		const results = await Promise.allSettled(
			[a, b].map(({ id }) =>
				client().update({ body: { projectIds: [id], expectedProjectIds: [] } })
			)
		)
		expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
			1
		)
		const rejected = results.find((result) => result.status === 'rejected')
		expect(rejected).toMatchObject({ reason: { code: 'CONFLICT' } })
		await expect(
			client().update({ body: { projectIds: [], expectedProjectIds: [] } })
		).rejects.toMatchObject({ code: 'CONFLICT' })
	})
	it('filters public selections by current visibility, website and repository, excludes self and exposes only preview fields', async () => {
		const source = await fixture('source'),
			a = await fixture('alpha'),
			b = await fixture('beta')
		await client().update({
			body: { projectIds: [b.id, source.id, a.id], expectedProjectIds: [] },
		})
		let detail = await publicClient().getBySlug({
			params: { slug: source.slug },
		})
		expect(detail.featuredProjects.map(({ id }) => id)).toEqual([b.id, a.id])
		expect(Object.keys(detail.featuredProjects[0]!).toSorted()).toEqual(
			[
				'id',
				'slug',
				'name',
				'logo',
				'tagline',
				'websiteUrl',
				'stars',
				'forks',
			].toSorted()
		)
		expect(detail.featuredProjects[0]).toMatchObject({ stars: 12, forks: 3 })
		await scope.db
			.update(project)
			.set({ status: 'draft' })
			.where(eq(project.id, b.id))
		await scope.db
			.update(project)
			.set({ websiteUrl: 'data:text/html,unsafe' })
			.where(eq(project.id, a.id))
		detail = await publicClient().getBySlug({ params: { slug: source.slug } })
		expect(detail.featuredProjects).toEqual([])
		// Admins still see unavailable selections for removal; visitors never do.
		expect((await client().list({})).projects).toHaveLength(3)
		await scope.db
			.update(project)
			.set({ websiteUrl: 'https://alpha.example.test' })
			.where(eq(project.id, a.id))
		await scope.db
			.delete(githubRepository)
			.where(eq(githubRepository.projectId, a.id))
		expect(
			(await publicClient().getBySlug({ params: { slug: source.slug } }))
				.featuredProjects
		).toEqual([])
		await scope.db.delete(project).where(eq(project.id, b.id))
		expect((await client().list({})).projects.map(({ id }) => id)).toEqual([
			source.id,
			a.id,
		])
	})
	it('enforces database uniqueness and position bounds, with deletion cleanup', async () => {
		const a = await fixture('alpha'),
			b = await fixture('beta')
		await scope.db
			.insert(featuredProject)
			.values({ projectId: a.id, position: 0 })
		await expect(
			scope.pool.query(
				'INSERT INTO featured_projects (project_id, position) VALUES ($1, 0)',
				[b.id]
			)
		).rejects.toMatchObject({ code: '23505' })
		await expect(
			scope.pool.query(
				'INSERT INTO featured_projects (project_id, position) VALUES ($1, 21)',
				[b.id]
			)
		).rejects.toMatchObject({ code: '23514' })
		await scope.db.delete(project).where(eq(project.id, a.id))
		expect(await scope.db.select().from(featuredProject)).toEqual([])
	})
})
