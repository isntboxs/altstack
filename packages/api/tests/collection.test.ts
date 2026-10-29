import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { createRouterClient } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { eq } from 'drizzle-orm'
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
import { sitemapCollections } from '@altstack/api/queries/collection'
import {
	collectionRouter,
	adminCollectionRouter,
} from '@altstack/api/routers/collection'

import {
	collection,
	collectionMember,
	project,
	githubRepository,
	user,
} from '@altstack/db/schemas'

import type { CollectionBody } from '@altstack/shared/schemas/collection'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'
let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>
let authorId: string
function context(
	role?: 'admin' | 'user',
	id = authorId,
	name = 'Collection writer'
): ORPCContext {
	return {
		db: scope.db,
		auth: role ? ({ user: { id, role, name } } as ORPCContext['auth']) : null,
	}
}
const admin = (id = authorId, name = 'Collection writer') =>
	createRouterClient(adminCollectionRouter, {
		context: context('admin', id, name),
	})
const publicClient = () =>
	createRouterClient(collectionRouter, { context: context() })
const listing = { query: { page: 1, limit: 12 } }
async function fixture(
	slug: string,
	status: 'published' | 'draft' = 'published',
	repository = true
) {
	const [row] = await scope.db
		.insert(project)
		.values({
			name: slug,
			slug,
			repositoryUrl: `https://github.com/fixtures/${slug}`,
			description: `Description ${slug}`,
			content: `# Documentation ${slug}`,
			logo: `projects/${slug}/logo.png`,
			status,
		})
		.returning()
	if (repository) {
		await scope.db.insert(githubRepository).values({
			projectId: row!.id,
			owner: 'fixtures',
			repo: slug,
			fetchedAt: new Date(),
		})
	}
	return row!
}
function body(
	ids: Array<string>,
	patch: Partial<CollectionBody> = {}
): CollectionBody {
	return {
		name: 'Community projects',
		slug: 'community-projects',
		description: 'An editorial collection',
		content: '## Introduction',
		kind: 'repository',
		sourceRepositoryUrl: 'https://github.com/fixtures/community-list',
		mainProjectId: null,
		status: 'published',
		projectIds: ids,
		...patch,
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
}, 60000)
beforeEach(async () => {
	await scope.db.delete(collection)
	await scope.db.delete(project)
	await scope.db.delete(user)
	authorId = randomUUID()
	await scope.db.insert(user).values({
		id: authorId,
		name: 'Collection writer',
		email: 'writer@example.test',
		role: 'admin',
	})
})
afterAll(async () => {
	await scope.close()
	await postgres.close()
})
describe('public curated collections', () => {
	it.each([undefined, 'user'] as const)(
		'rejects %s admin access before touching the database over REST and RPC',
		async (role) => {
			const ctx = {
				...context(role),
				db: new Proxy(scope.db, {
					get() {
						throw new Error('Unauthorized database access')
					},
				}),
			}
			const rest = new OpenAPIHandler({
					admin: { collection: adminCollectionRouter },
				}),
				rpc = new RPCHandler({ admin: { collection: adminCollectionRouter } })
			const id = randomUUID()
			const operations = [
				['list', 'QUERY', '/admin/collections', { query: {} }],
				['getById', 'QUERY', `/admin/collections/${id}`, { params: { id } }],
				[
					'create',
					'POST',
					'/admin/collections',
					{ body: body([], { status: 'draft' }) },
				],
				[
					'update',
					'PUT',
					`/admin/collections/${id}`,
					{
						params: { id },
						body: { ...body([], { status: 'draft' }), expectedVersion: 1 },
					},
				],
				[
					'delete',
					'DELETE',
					`/admin/collections/${id}`,
					{ params: { id }, body: { expectedVersion: 1 } },
				],
			] as const
			for (const [name, method, path, input] of operations) {
				const response = await rest.handle(
					new Request(`http://localhost/api${path}`, {
						method,
						headers: { 'content-type': 'application/json' },
						...('body' in input ? { body: JSON.stringify(input.body) } : {}),
					}),
					{ prefix: '/api', context: ctx }
				)
				expect(response.response?.status).toBe(role ? 403 : 401)
				const result = await rpc.handle(
					new Request(`http://localhost/rpc/admin/collection/${name}`, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ json: input }),
					}),
					{ prefix: '/rpc', context: ctx }
				)
				expect(result.response?.status).toBe(role ? 403 : 401)
			}
		}
	)
	it('creates/updates ordered references without copying content or changing catalogue timestamps', async () => {
		const a = await fixture('alpha'),
			b = await fixture('beta')
		const saved = await admin().create({ body: body([b.id, a.id]) })
		expect(saved.authorName).toBe('Collection writer')
		expect(saved.version).toBe(1)
		const detail = await publicClient().getBySlug({
			params: { slug: saved.slug },
		})
		expect(detail.projects.map((p) => p.id)).toEqual([b.id, a.id])
		expect(detail.projects[0]?.content).toBe(b.content)
		expect(detail).not.toHaveProperty('authorId')
		expect(detail).not.toHaveProperty('version')
		expect(detail.projects[0]).not.toHaveProperty('submitterId')
		const another = randomUUID()
		await scope.db.insert(user).values({
			id: another,
			name: 'Editor two',
			email: 'editor@example.test',
			role: 'admin',
		})
		const updated = await admin(another, 'Editor two').update({
			params: { id: saved.id },
			body: { ...body([a.id, b.id]), name: 'Edited title', expectedVersion: 1 },
		})
		expect(updated.authorName).toBe('Collection writer')
		expect(updated.version).toBe(2)
		expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
			saved.updatedAt.getTime()
		)
		expect(updated.projects.map((p) => p.id)).toEqual([a.id, b.id])
		await scope.db
			.update(project)
			.set({ content: 'Updated project documentation' })
			.where(eq(project.id, a.id))
		expect(
			(await publicClient().getBySlug({ params: { slug: saved.slug } }))
				.projects[0]?.content
		).toBe('Updated project documentation')
		expect(
			(await scope.db.select().from(project).where(eq(project.id, b.id)))[0]
				?.updatedAt
		).toEqual(b.updatedAt)
		await scope.db.delete(user).where(eq(user.id, authorId))
		expect(
			(await publicClient().getBySlug({ params: { slug: saved.slug } }))
				.authorName
		).toBe('Collection writer')
	})
	it('filters drafts, hidden members, absent repository metadata and unavailable targets consistently', async () => {
		const target = await fixture('target'),
			a = await fixture('alpha'),
			b = await fixture('beta')
		const saved = await admin().create({
			body: body([a.id, b.id], {
				kind: 'alternatives',
				sourceRepositoryUrl: null,
				mainProjectId: target.id,
			}),
		})
		await admin().create({
			body: body([a.id], {
				slug: 'private-draft',
				name: 'PRIVATE TITLE',
				status: 'draft',
			}),
		})
		expect(
			(await publicClient().list(listing)).collections.map((c) => c.slug)
		).toEqual([saved.slug])
		await expect(
			publicClient().getBySlug({ params: { slug: 'private-draft' } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		await scope.db
			.update(project)
			.set({ status: 'draft' })
			.where(eq(project.id, a.id))
		let detail = await publicClient().getBySlug({
			params: { slug: saved.slug },
		})
		expect(detail.projects.map((p) => p.id)).toEqual([b.id])
		expect(detail.memberCount).toBe(1)
		expect(
			(await publicClient().list(listing)).collections[0]?.memberCount
		).toBe(1)
		await scope.db
			.update(project)
			.set({ status: 'draft' })
			.where(eq(project.id, target.id))
		expect(await publicClient().list(listing)).toEqual({
			collections: [],
			total: 0,
		})
		expect(await sitemapCollections(scope.db)).toEqual([])
		await expect(
			publicClient().getBySlug({ params: { slug: saved.slug } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		await scope.db
			.update(project)
			.set({ status: 'published' })
			.where(eq(project.id, target.id))
		expect((await sitemapCollections(scope.db)).map((c) => c.slug)).toEqual([
			saved.slug,
		])
		await scope.db
			.delete(githubRepository)
			.where(eq(githubRepository.projectId, b.id))
		expect((await publicClient().list(listing)).collections).toEqual([])
		await scope.db
			.update(project)
			.set({ status: 'published' })
			.where(eq(project.id, a.id))
		detail = await publicClient().getBySlug({ params: { slug: saved.slug } })
		expect(detail.projects.map((p) => p.id)).toEqual([a.id])
		await scope.db.delete(project).where(eq(project.id, target.id))
		expect(
			(await admin().getById({ params: { id: saved.id } })).mainProjectId
		).toBeNull()
		expect((await publicClient().list(listing)).collections).toEqual([])
	})
	it('keeps repository lists target-free, cascades deleted members, and hides empty lists', async () => {
		const a = await fixture('alpha'),
			b = await fixture('beta')
		const saved = await admin().create({ body: body([b.id, a.id]) })
		expect(
			(await publicClient().getBySlug({ params: { slug: saved.slug } }))
				.mainProject
		).toBeNull()
		await scope.db.delete(project).where(eq(project.id, b.id))
		expect(
			(
				await publicClient().getBySlug({ params: { slug: saved.slug } })
			).projects.map((p) => p.id)
		).toEqual([a.id])
		await scope.db.delete(project).where(eq(project.id, a.id))
		expect(await scope.db.select().from(collectionMember)).toEqual([])
		expect((await publicClient().list(listing)).collections).toEqual([])
		await expect(
			publicClient().getBySlug({ params: { slug: saved.slug } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
	})
	it('rejects unknown/unpublished projects, duplicate slugs, forged authors and invalid edits atomically', async () => {
		const a = await fixture('alpha'),
			hidden = await fixture('hidden', 'draft'),
			noRepo = await fixture('no-repo', 'published', false)
		const saved = await admin().create({ body: body([a.id]) })
		await expect(admin().create({ body: body([a.id]) })).rejects.toMatchObject({
			code: 'CONFLICT',
		})
		for (const id of [randomUUID(), hidden.id, noRepo.id]) {
			await expect(
				admin().update({
					params: { id: saved.id },
					body: { ...body([id]), expectedVersion: 1 },
				})
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
			await expect(
				admin().create({
					body: body([a.id], {
						slug: 'invalid-main',
						kind: 'ecosystem',
						sourceRepositoryUrl: null,
						mainProjectId: id,
					}),
				})
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		}
		await expect(
			admin().create({
				body: {
					...body([a.id], { slug: 'forged' }),
					authorId: randomUUID(),
				} as CollectionBody,
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		expect((await admin().getById({ params: { id: saved.id } })).version).toBe(
			1
		)
		expect(
			(await scope.db.select().from(collectionMember)).map((m) => m.projectId)
		).toEqual([a.id])
	})
	it('publishes and unpublishes explicitly and paginates eligible collections without draft leakage', async () => {
		const a = await fixture('alpha')
		const draft = await admin().create({ body: body([], { status: 'draft' }) })
		expect((await publicClient().list(listing)).total).toBe(0)
		const published = await admin().update({
			params: { id: draft.id },
			body: { ...body([a.id]), expectedVersion: 1 },
		})
		expect(published.version).toBe(2)
		await admin().create({ body: body([a.id], { slug: 'second-list' }) })
		const first = await publicClient().list({ query: { page: 1, limit: 1 } }),
			second = await publicClient().list({ query: { page: 2, limit: 1 } })
		expect(first.total).toBe(2)
		expect(first.collections).toHaveLength(1)
		expect(second.collections).toHaveLength(1)
		expect(first.collections[0]?.id).not.toBe(second.collections[0]?.id)
		await admin().update({
			params: { id: draft.id },
			body: { ...body([a.id], { status: 'draft' }), expectedVersion: 2 },
		})
		expect(
			(await publicClient().list(listing)).collections.map((c) => c.slug)
		).toEqual(['second-list'])
		await expect(
			publicClient().getBySlug({ params: { slug: draft.slug } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
	})

	it('detects concurrent save/delete conflicts and deletes membership with the collection', async () => {
		const a = await fixture('alpha')
		const saved = await admin().create({ body: body([a.id]) })
		const writes = await Promise.allSettled(
			['First', 'Second'].map((name) =>
				admin().update({
					params: { id: saved.id },
					body: { ...body([a.id]), name, expectedVersion: 1 },
				})
			)
		)
		expect(
			writes.filter((result) => result.status === 'fulfilled')
		).toHaveLength(1)
		expect(writes.find((result) => result.status === 'rejected')).toMatchObject(
			{ reason: { code: 'CONFLICT' } }
		)
		await expect(
			admin().delete({ params: { id: saved.id }, body: { expectedVersion: 1 } })
		).rejects.toMatchObject({ code: 'CONFLICT' })
		expect(
			await admin().delete({
				params: { id: saved.id },
				body: { expectedVersion: 2 },
			})
		).toEqual({ success: true })
		expect(await scope.db.select().from(collectionMember)).toEqual([])
		expect((await publicClient().list(listing)).collections).toEqual([])
	})
})
