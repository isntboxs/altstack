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
	vi,
} from 'vite-plus/test'

import type { ORPCContext } from '@altstack/api/context'
import { sitemapBlogs } from '@altstack/api/queries/blog'
import { adminBlogRouter, blogRouter } from '@altstack/api/routers/blog'
import {
	promoteTempImageToBlogCover,
	deleteFinalKeysBestEffort,
	TempUploadMissingError,
} from '@altstack/api/storage'

import { blogPost, user } from '@altstack/db/schemas'

import { blogReadTime } from '@altstack/shared/schemas'
import type { BlogBody } from '@altstack/shared/schemas'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'

vi.mock('@altstack/api/storage', () => {
	return {
		promoteTempImageToBlogCover: vi.fn(),
		deleteFinalKeysBestEffort: vi.fn(),
		TempUploadMissingError: class extends Error {},
		InvalidTempUploadError: class extends Error {},
	}
})

let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>
let authorId: string
const body = (patch: Partial<BlogBody> = {}): BlogBody => {
	return {
		title: 'Building software that lasts',
		slug: 'building-software',
		description: 'Practical engineering ideas.',
		coverUrl: 'https://images.example.test/cover.webp',
		content: '## Start small\n\nBuild something useful.',
		status: 'draft',
		...patch,
	}
}
function context(role?: 'admin' | 'user', id = authorId): ORPCContext {
	return {
		db: scope.db,
		auth: role
			? ({ user: { id, role, name: 'Original author' } } as ORPCContext['auth'])
			: null,
	}
}
const admin = () =>
	createRouterClient(adminBlogRouter, { context: context('admin') })
const reader = () => createRouterClient(blogRouter, { context: context() })
const listing = { query: { page: 1, limit: 12 } }

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
	vi.mocked(promoteTempImageToBlogCover)
		.mockReset()
		.mockImplementation(({ postId }) =>
			Promise.resolve(`blogs/${postId}/cover-${randomUUID()}.png`)
		)
	vi.mocked(deleteFinalKeysBestEffort).mockReset().mockResolvedValue(undefined)
	await scope.db.delete(blogPost)
	await scope.db.delete(user)
	authorId = randomUUID()
	await scope.db.insert(user).values({
		id: authorId,
		name: 'Original author',
		email: 'blog@example.test',
		image: 'https://images.example.test/author.png',
		role: 'admin',
	})
})
afterAll(async () => {
	await scope.close()
	await postgres.close()
})

describe('blog publishing and CRUD', () => {
	it('promotes uploaded covers, retains unchanged covers across slug edits, and cleans up replaced or deleted covers', async () => {
		const upload = 'tmp/screenshots/cover-1.png'
		const saved = await admin().create({
			body: body({ coverUrl: upload, status: 'published' }),
		})
		expect(saved.coverUrl).toMatch(new RegExp(`^blogs/${saved.id}/`))
		expect(deleteFinalKeysBestEffort).toHaveBeenCalledWith([upload])
		expect(
			(await reader().getBySlug({ params: { slug: saved.slug } })).coverUrl
		).toBe(saved.coverUrl)
		await admin().update({
			params: { id: saved.id },
			body: {
				...body({ slug: 'renamed-post', coverUrl: saved.coverUrl }),
				expectedVersion: 1,
			},
		})
		expect(promoteTempImageToBlogCover).toHaveBeenCalledTimes(1)
		vi.mocked(deleteFinalKeysBestEffort).mockClear()
		const replacement = await admin().update({
			params: { id: saved.id },
			body: {
				...body({ slug: 'renamed-post', coverUrl: upload }),
				expectedVersion: 2,
			},
		})
		expect(replacement.coverUrl).not.toBe(saved.coverUrl)
		expect(deleteFinalKeysBestEffort).toHaveBeenCalledWith([
			upload,
			saved.coverUrl,
		])
		await admin().delete({
			params: { id: saved.id },
			body: { expectedVersion: 3 },
		})
		expect(deleteFinalKeysBestEffort).toHaveBeenCalledWith([
			replacement.coverUrl,
		])
	})
	it('keeps the old cover and temporary source when a database save fails after promotion', async () => {
		const saved = await admin().create({
			body: body({ coverUrl: 'tmp/screenshots/cover-1.png' }),
		})
		await admin().create({ body: body({ slug: 'taken-slug' }) })
		vi.mocked(deleteFinalKeysBestEffort).mockClear()
		await expect(
			admin().update({
				params: { id: saved.id },
				body: {
					...body({
						slug: 'taken-slug',
						coverUrl: 'tmp/screenshots/cover-2.png',
					}),
					expectedVersion: 1,
				},
			})
		).rejects.toMatchObject({ code: 'CONFLICT' })
		const current = await admin().getById({ params: { id: saved.id } })
		expect(current.coverUrl).toBe(saved.coverUrl)
		expect(current.version).toBe(1)
		const removed = vi
			.mocked(deleteFinalKeysBestEffort)
			.mock.calls.flatMap(([keys]) => keys)
		expect(removed).toHaveLength(1)
		expect(removed[0]).toMatch(/^blogs\//)
		expect(removed).not.toContain(saved.coverUrl)
		expect(removed).not.toContain('tmp/screenshots/cover-2.png')
	})
	it('rejects cross-post keys and expired uploads while leaving HTTPS covers unmanaged', async () => {
		const saved = await admin().create({
			body: body({ coverUrl: 'tmp/screenshots/cover-1.png' }),
		})
		await expect(
			admin().create({
				body: body({ slug: 'another', coverUrl: saved.coverUrl }),
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		const other = await admin().create({ body: body({ slug: 'another' }) })
		await expect(
			admin().update({
				params: { id: other.id },
				body: {
					...body({ slug: other.slug, coverUrl: saved.coverUrl }),
					expectedVersion: 1,
				},
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		vi.mocked(promoteTempImageToBlogCover).mockRejectedValueOnce(
			new TempUploadMissingError()
		)
		await expect(
			admin().update({
				params: { id: saved.id },
				body: {
					...body({ coverUrl: 'tmp/screenshots/cover-2.png' }),
					expectedVersion: 1,
				},
			})
		).rejects.toMatchObject({ code: 'UPLOAD_EXPIRED' })
		vi.mocked(deleteFinalKeysBestEffort).mockClear()
		await admin().delete({
			params: { id: other.id },
			body: { expectedVersion: 1 },
		})
		expect(deleteFinalKeysBestEffort).not.toHaveBeenCalled()
	})
	it('can switch an uploaded cover to an HTTPS URL and deletes only the old managed image', async () => {
		const saved = await admin().create({
			body: body({ coverUrl: 'tmp/screenshots/cover-1.png' }),
		})
		vi.mocked(deleteFinalKeysBestEffort).mockClear()
		const updated = await admin().update({
			params: { id: saved.id },
			body: { ...body(), expectedVersion: 1 },
		})
		expect(updated.coverUrl).toBe(body().coverUrl)
		expect(deleteFinalKeysBestEffort).toHaveBeenCalledWith([saved.coverUrl])
		vi.mocked(deleteFinalKeysBestEffort).mockClear()
		await admin().delete({
			params: { id: saved.id },
			body: { expectedVersion: 2 },
		})
		expect(deleteFinalKeysBestEffort).not.toHaveBeenCalled()
	})
	it.each([undefined, 'user'] as const)(
		'protects every admin operation over REST and RPC from %s access',
		async (role) => {
			const ctx = {
				...context(role),
				db: new Proxy(scope.db, {
					get() {
						throw new Error('Unauthorized database access')
					},
				}),
			}
			const rest = new OpenAPIHandler({ admin: { blog: adminBlogRouter } })
			const rpc = new RPCHandler({ admin: { blog: adminBlogRouter } })
			const id = randomUUID()
			for (const [name, method, path, input] of [
				['list', 'QUERY', '/admin/blogs', listing],
				['getById', 'QUERY', `/admin/blogs/${id}`, { params: { id } }],
				['create', 'POST', '/admin/blogs', { body: body() }],
				[
					'update',
					'PUT',
					`/admin/blogs/${id}`,
					{ params: { id }, body: { ...body(), expectedVersion: 1 } },
				],
				[
					'delete',
					'DELETE',
					`/admin/blogs/${id}`,
					{ params: { id }, body: { expectedVersion: 1 } },
				],
			] as const) {
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
					new Request(`http://localhost/rpc/admin/blog/${name}`, {
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
	it('keeps drafts private, publishes once, recalculates reading time, and preserves the byline', async () => {
		const draft = await admin().create({ body: body() })
		expect(draft.publishedAt).toBeNull()
		expect((await admin().list(listing)).total).toBe(1)
		expect(await reader().list(listing)).toEqual({ posts: [], total: 0 })
		expect(await sitemapBlogs(scope.db)).toEqual([])
		await expect(
			reader().getBySlug({ params: { slug: draft.slug } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		const published = await admin().update({
			params: { id: draft.id },
			body: {
				...body({ status: 'published', content: 'word '.repeat(401) }),
				expectedVersion: 1,
			},
		})
		expect(published.publishedAt).toBeInstanceOf(Date)
		expect(published.readTime).toBe(3)
		const detail = await reader().getBySlug({ params: { slug: draft.slug } })
		expect(detail.authorImage).toBe('https://images.example.test/author.png')
		expect(detail.authorName).toBe('Original author')
		expect(detail).not.toHaveProperty('authorId')
		expect(detail).not.toHaveProperty('version')
		expect(detail).not.toHaveProperty('status')
		await admin().update({
			params: { id: draft.id },
			body: { ...body(), expectedVersion: 2 },
		})
		expect((await reader().list(listing)).total).toBe(0)
		const republished = await admin().update({
			params: { id: draft.id },
			body: {
				...body({ status: 'published', slug: 'new-slug' }),
				expectedVersion: 3,
			},
		})
		expect(republished.publishedAt).toEqual(published.publishedAt)
		expect(republished.readTime).toBe(1)
		await expect(
			reader().getBySlug({ params: { slug: draft.slug } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		expect((await sitemapBlogs(scope.db)).map((post) => post.slug)).toEqual([
			'new-slug',
		])
		await scope.db.delete(user).where(eq(user.id, authorId))
		const byline = await reader().getBySlug({ params: { slug: 'new-slug' } })
		expect(byline.authorName).toBe('Original author')
		expect(byline.authorImage).toBeNull()
	})
	it('rejects duplicate slugs, unsafe covers, empty content, and forged author fields', async () => {
		await admin().create({ body: body() })
		await expect(admin().create({ body: body() })).rejects.toMatchObject({
			code: 'CONFLICT',
		})
		for (const input of [
			body({ coverUrl: 'javascript:alert(1)' }),
			body({ coverUrl: '' }),
			body({ coverUrl: 'not-a-url' }),
			body({ coverUrl: 'https://user:password@images.example.test/cover.png' }),
			body({ content: ' ' }),
			{ ...body(), authorName: 'Forged author' },
			{ ...body(), publishedAt: new Date() },
		]) {
			await expect(admin().create({ body: input })).rejects.toMatchObject({
				code: 'BAD_REQUEST',
			})
		}
		expect((await admin().list(listing)).total).toBe(1)
		expect(blogReadTime('')).toBe(1)
	})
	it('paginates only published cards, omitting article content and private fields', async () => {
		for (const slug of ['first', 'second', 'third']) {
			await admin().create({ body: body({ slug, status: 'published' }) })
		}
		await admin().create({ body: body() })
		const first = await reader().list({ query: { page: 1, limit: 2 } })
		const second = await reader().list({ query: { page: 2, limit: 2 } })
		expect(first.total).toBe(3)
		expect(second.posts).toHaveLength(1)
		expect(
			new Set([...first.posts, ...second.posts].map((post) => post.id)).size
		).toBe(3)
		expect(first.posts[0]).not.toHaveProperty('content')
		expect(first.posts[0]).not.toHaveProperty('authorId')
	})
	it('rejects stale concurrent edits/deletes and removes a post from every public surface', async () => {
		const saved = await admin().create({ body: body({ status: 'published' }) })
		const writes = await Promise.allSettled(
			['First edit', 'Second edit'].map((title) =>
				admin().update({
					params: { id: saved.id },
					body: { ...body({ title, status: 'published' }), expectedVersion: 1 },
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
		expect(await sitemapBlogs(scope.db)).toEqual([])
		expect((await reader().list(listing)).total).toBe(0)
		await expect(
			reader().getBySlug({ params: { slug: saved.slug } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		await expect(
			admin().getById({ params: { id: saved.id } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
	})
})
