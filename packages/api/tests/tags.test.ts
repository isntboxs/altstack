import { createRouterClient } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { fileURLToPath } from 'node:url'
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vite-plus/test'

import type { ORPCContext } from '@altstack/api/context'
import { octokit } from '@altstack/api/github'
import { refreshProjectGithub } from '@altstack/api/github-refresh'
import { openApiHandler } from '@altstack/api/handler'
import { routers } from '@altstack/api/routers'

import {
	githubRepository,
	project,
	projectTag,
	tag,
} from '@altstack/db/schemas'
import { syncProjectTags } from '@altstack/db/tags'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'

let postgres: Awaited<ReturnType<typeof connectTestPostgres>>
let scope: Awaited<ReturnType<typeof postgres.createSchema>>
const migrationsFolder = fileURLToPath(
	new URL('../../db/src/migrations', import.meta.url)
)
function client(role: string | null = null) {
	return createRouterClient(routers, {
		context: {
			db: scope.db,
			auth: role
				? ({ user: { id: crypto.randomUUID(), role } } as ORPCContext['auth'])
				: null,
		},
	})
}
async function fixture(
	topics: Array<string>,
	status: 'published' | 'draft' = 'published'
) {
	const slug = `tags-${crypto.randomUUID()}`
	const [row] = await scope.db
		.insert(project)
		.values({
			name: slug,
			slug,
			repositoryUrl: `https://github.com/test/${slug}`,
			status,
			tagline: 'Tagged project',
			description: 'Tagged fixture',
			logo: 'test/logo.png',
		})
		.returning()
	if (!row) throw new Error('Missing project')
	await scope.db.insert(githubRepository).values({
		projectId: row.id,
		owner: 'test',
		repo: slug,
		fetchedAt: new Date(),
	})
	await scope.db.transaction((tx) => syncProjectTags(tx, row.id, topics))
	return row
}
beforeAll(async () => {
	postgres = await connectTestPostgres()
})
beforeEach(async () => {
	scope = await postgres.createSchema()
	await migrate(scope.db, {
		migrationsFolder,
		migrationsSchema: scope.migrationsSchema,
	})
})
afterEach(async () => {
	vi.restoreAllMocks()
	await scope.close()
})
afterAll(async () => {
	await postgres.close()
})

describe('GitHub topic tags', () => {
	it('stores topics from GitHub refresh and preserves them when the next fetch fails', async () => {
		const row = await fixture(['old-topic'])
		type Repository = Awaited<ReturnType<typeof octokit.rest.repos.get>>
		type Commit = Awaited<ReturnType<typeof octokit.rest.repos.getCommit>>
		type Release = Awaited<
			ReturnType<typeof octokit.rest.repos.getLatestRelease>
		>
		vi.spyOn(octokit.rest.repos, 'get').mockResolvedValue({
			data: {
				id: 123,
				private: false,
				owner: { login: 'test' },
				name: row.slug,
				topics: ['typescript', 'react'],
				stargazers_count: 100,
				forks_count: 10,
				created_at: '2020-01-01T00:00:00Z',
				default_branch: 'main',
			},
		} as unknown as Repository)
		vi.spyOn(octokit.rest.repos, 'getCommit').mockResolvedValue({
			data: { commit: { committer: { date: '2026-10-01T00:00:00Z' } } },
		} as unknown as Commit)
		vi.spyOn(octokit.rest.repos, 'getLatestRelease').mockResolvedValue({
			data: { tag_name: 'v1' },
		} as unknown as Release)
		await refreshProjectGithub(scope.db, row.id)
		expect(
			(
				await client().project.getBySlug({ params: { slug: row.slug } })
			).tags.map((item) => item.slug)
		).toEqual(['react', 'typescript'])
		vi.mocked(octokit.rest.repos.get).mockRejectedValue(
			new Error('Network unavailable')
		)
		await expect(refreshProjectGithub(scope.db, row.id)).rejects.toMatchObject({
			code: 'INTERNAL_SERVER_ERROR',
		})
		expect(
			(
				await client().project.getBySlug({ params: { slug: row.slug } })
			).tags.map((item) => item.slug)
		).toEqual(['react', 'typescript'])
	})

	it('serves public tag filters through REST without leaking private assignment counts', async () => {
		await fixture(['backend'])
		await fixture(['backend'], 'draft')
		const result = await openApiHandler.handle(
			new Request(
				'http://localhost/api/reference/tags?letter=B&sort=name-asc',
				{ method: 'QUERY' }
			),
			{ prefix: '/api/reference', context: { db: scope.db, auth: null } }
		)
		expect(result.response?.status).toBe(200)
		const body: unknown = await result.response?.json()
		expect(body).toMatchObject({
			tags: [{ slug: 'backend', projectCount: 1 }],
			pagination: { totalItems: 1 },
		})
		expect(JSON.stringify(body)).not.toContain('assignmentCount')
		expect(JSON.stringify(body)).not.toContain('hidden')
	})
	it('deduplicates topics across projects and replaces links without overwriting admin curation', async () => {
		const a = await fixture(['TypeScript', 'typescript', 'react'])
		await fixture(['typescript'])
		const tags = await scope.db.select().from(tag)
		expect(tags).toHaveLength(2)
		const ts = tags.find((item) => item.slug === 'typescript')!
		await client('admin').admin.tag.update({
			params: { id: ts.id },
			body: {
				name: 'TypeScript',
				description: 'Typed JavaScript',
				hidden: true,
			},
		})
		await scope.db.transaction((tx) =>
			syncProjectTags(tx, a.id, ['typescript', 'nodejs'])
		)
		const [curated] = await scope.db.select().from(tag).where(eq(tag.id, ts.id))
		expect(curated).toMatchObject({
			name: 'TypeScript',
			description: 'Typed JavaScript',
			hidden: true,
		})
		const detail = await client().project.getBySlug({
			params: { slug: a.slug },
		})
		expect(detail.tags.map((item) => item.slug)).toEqual(['nodejs'])
		await scope.db.transaction((tx) => syncProjectTags(tx, a.id, []))
		expect(
			await scope.db
				.select()
				.from(projectTag)
				.where(eq(projectTag.projectId, a.id))
		).toHaveLength(0)
	})

	it('exposes only tags with published projects and counts published assignments', async () => {
		const a = await fixture(['react', 'beta', '3d'])
		await fixture(['react'])
		await fixture(['react', 'draft-only'], 'draft')
		const result = await client().tag.list({ query: {} })
		expect(result.tags.map((item) => [item.slug, item.projectCount])).toEqual([
			['react', 2],
			['3d', 1],
			['beta', 1],
		])
		expect(
			(await client().tag.list({ query: { letter: 'B' } })).tags.map(
				(item) => item.slug
			)
		).toEqual(['beta'])
		expect(
			(await client().tag.list({ query: { letter: '&' } })).tags.map(
				(item) => item.slug
			)
		).toEqual(['3d'])
		expect((await client().tag.list({ query: { q: '%' } })).tags).toHaveLength(
			0
		)
		expect(
			(await client().tag.list({ query: { q: 'REA' } })).tags.map(
				(item) => item.slug
			)
		).toEqual(['react'])
		const page = await client().tag.list({
			query: { sort: 'name-desc', page: 2, limit: 1 },
		})
		expect(page.tags[0]?.slug).toBe('beta')
		expect(page.pagination).toMatchObject({
			totalItems: 3,
			totalPages: 3,
			hasPreviousPage: true,
			hasNextPage: true,
		})
		await expect(
			client().tag.getBySlug({ params: { slug: 'draft-only' } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		const matches = await client().project.search({ query: { tag: 'react' } })
		expect(matches.projects).toHaveLength(2)
		expect(matches.projects.some((item) => item.id === a.id)).toBe(true)
		expect(
			(await client().project.search({ query: { tag: 'unknown' } })).projects
		).toEqual([])
	})

	it('enforces admin CRUD permissions, stable topic identity, and safe deletion', async () => {
		await expect(client().admin.tag.list({ query: {} })).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		})
		await expect(
			client('user').admin.tag.create({ body: { slug: 'test', name: 'Test' } })
		).rejects.toMatchObject({ code: 'FORBIDDEN' })
		const admin = client('admin').admin.tag
		const unused = await admin.create({
			body: { slug: 'unused', name: 'Unused' },
		})
		await expect(
			admin.create({ body: { slug: 'UNUSED', name: 'Duplicate' } })
		).rejects.toMatchObject({ code: 'CONFLICT' })
		await admin.remove({ params: { id: unused.id } })
		await fixture(['react'], 'draft')
		const { tags } = await admin.list({ query: {} })
		const used = tags[0]!
		expect(used).toMatchObject({
			slug: 'react',
			projectCount: 0,
			assignmentCount: 1,
		})
		await expect(
			admin.remove({ params: { id: used.id } })
		).rejects.toMatchObject({ code: 'CONFLICT' })
		await admin.update({
			params: { id: used.id },
			body: { name: 'React', hidden: true },
		})
		expect((await admin.list({ query: {} })).tags[0]).toMatchObject({
			slug: 'react',
			name: 'React',
			hidden: true,
		})
	})

	it('preserves omitted fields during partial updates and returns unchanged tags for empty patches', async () => {
		const admin = client('admin').admin.tag
		const created = await admin.create({
			body: {
				slug: 'curated',
				name: 'Curated',
				description: 'Keep this description',
				hidden: true,
			},
		})
		const params = { id: created.id }
		const renamed = await admin.update({ params, body: { name: 'Renamed' } })
		expect(renamed).toMatchObject({
			name: 'Renamed',
			description: 'Keep this description',
			hidden: true,
		})
		const visible = await admin.update({ params, body: { hidden: false } })
		expect(visible).toMatchObject({
			name: 'Renamed',
			description: 'Keep this description',
			hidden: false,
		})
		const cleared = await admin.update({ params, body: { description: null } })
		expect(cleared).toMatchObject({
			name: 'Renamed',
			description: null,
			hidden: false,
		})
		expect(await admin.update({ params, body: {} })).toEqual(cleared)
		expect(await admin.update({ params, body: { name: undefined } })).toEqual(
			cleared
		)
		await expect(
			admin.update({ params: { id: crypto.randomUUID() }, body: {} })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
	})

	it('keeps hidden tags out of the directory, detail, and project search after resync', async () => {
		const row = await fixture(['typescript'])
		const { tag: ts } = await client().tag.getBySlug({
			params: { slug: 'typescript' },
		})
		await client('admin').admin.tag.update({
			params: { id: ts.id },
			body: { name: 'TypeScript', hidden: true },
		})
		await scope.db.transaction((tx) =>
			syncProjectTags(tx, row.id, ['typescript'])
		)
		expect((await client().tag.list({ query: {} })).tags).toEqual([])
		await expect(
			client().tag.getBySlug({ params: { slug: 'typescript' } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		expect(
			(await client().project.search({ query: { tag: 'typescript' } })).projects
		).toEqual([])
		expect(
			(await client().project.getBySlug({ params: { slug: row.slug } })).tags
		).toEqual([])
	})

	it('reuses one tag during concurrent imports and rolls back malformed snapshots', async () => {
		const a = await fixture([])
		const b = await fixture([])
		await Promise.all(
			[a, b].map((item) =>
				scope.db.transaction((tx) =>
					syncProjectTags(tx, item.id, ['typescript'])
				)
			)
		)
		expect(await scope.db.select().from(tag)).toHaveLength(1)
		await expect(
			scope.db.transaction((tx) => syncProjectTags(tx, a.id, ['bad topic']))
		).rejects.toThrow(/lowercase letters/)
		expect(await scope.db.select().from(projectTag)).toHaveLength(2)
		await scope.db.delete(project).where(eq(project.id, a.id))
		expect(await scope.db.select().from(projectTag)).toHaveLength(1)
	})
})
