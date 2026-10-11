import { createRouterClient } from '@orpc/server'
import { eq, inArray } from 'drizzle-orm'
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
import { openApiHandler, rpcHandler } from '@altstack/api/handler'
import { getDirectProjectCategories } from '@altstack/api/queries/category'
import { routers } from '@altstack/api/routers'

import {
	category,
	categoryPath,
	project,
	projectCategory,
} from '@altstack/db/schemas'
import { seedTaxonomy } from '@altstack/db/seed-taxonomy'

import { categoryNodeSchema } from '@altstack/shared/schemas/category'
import { getProjectBySlugOutputSchema } from '@altstack/shared/schemas/project'

import { createZedFixture } from '../../db/tests/fixtures/category-hierarchy'
import { connectTestPostgres } from '../../db/tests/helpers/postgres'

const migrationsFolder = fileURLToPath(
	new URL('../../db/src/migrations', import.meta.url)
)
const ROOT = 'developer-tools'
const EDITORS = `${ROOT}/ides-code-editors`
const AI = `${EDITORS}/ai-powered-editors`
const GENERAL = `${EDITORS}/general-purpose-editors`

let postgres: Awaited<ReturnType<typeof connectTestPostgres>> | undefined
let database: Awaited<ReturnType<NonNullable<typeof postgres>['createSchema']>>
let scope: typeof database | undefined
const fixtures: Array<Awaited<ReturnType<typeof createZedFixture>>> = []

const adminAuth = {
	user: { id: crypto.randomUUID(), role: 'admin' },
} as unknown as ORPCContext['auth']

function clientWith(auth: ORPCContext['auth'] = null) {
	return createRouterClient(routers, { context: { db: database.db, auth } })
}

async function zed(status: 'draft' | 'published' = 'published') {
	const fixture = await createZedFixture(database.db, status)
	fixtures.push(fixture)
	const row = await database.db.query.project.findFirst({
		where: { id: fixture.projectId },
	})
	if (!row) throw new Error('Missing Zed fixture')
	return { ...fixture, slug: row.slug }
}

async function rest(
	path: string,
	auth: ORPCContext['auth'] = null,
	method = 'QUERY'
) {
	return openApiHandler.handle(
		new Request(`http://localhost/api/reference${path}`, { method }),
		{
			prefix: '/api/reference',
			context: { db: database.db, auth },
		}
	)
}

async function rpc(
	path: string,
	input: unknown,
	auth: ORPCContext['auth'] = null
) {
	return rpcHandler.handle(
		new Request(`http://localhost/api/rpc/${path}`, {
			method: 'QUERY',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ json: input }),
		}),
		{
			prefix: '/api/rpc',
			context: { db: database.db, auth },
		}
	)
}

beforeAll(async () => {
	postgres = await connectTestPostgres()
}, 60_000)
beforeEach(async () => {
	scope = undefined
	if (!postgres) throw new Error('Missing cloud development connection')
	database = await postgres.createSchema()
	scope = database
	await migrate(database.db, {
		migrationsFolder,
		migrationsSchema: database.migrationsSchema,
	})
	await seedTaxonomy(database.db)
}, 60_000)
afterEach(async () => {
	try {
		for (const fixture of fixtures.splice(0)) await fixture.dispose()
	} finally {
		await scope?.close()
	}
}, 60_000)
afterAll(async () => {
	await postgres?.close()
}, 60_000)

describe('public category hierarchy', () => {
	it('counts and searches a published project once at both leaves and every ancestor', async () => {
		const fixture = await zed()
		const client = clientWith()
		const result = await client.category.list({})
		expect(result.categories).toHaveLength(4)
		expect(result.categories.map((node) => node.name)).toEqual(
			result.categories.map((node) => node.name).toSorted()
		)
		for (const node of result.categories) {
			expect(categoryNodeSchema.parse(node)).toEqual(node)
			expect(node.projectCount).toBe(1)
			const search = await client.project.search({
				query: { category: node.slug },
			})
			expect(search.projects.map((item) => item.id)).toEqual([
				fixture.projectId,
			])
			expect(search.pagination.totalItems).toBe(node.projectCount)
		}
		expect(result.categories.find((node) => node.slug === ROOT)).toMatchObject({
			depth: 1,
			parentId: null,
			path: ROOT,
			isLeaf: false,
		})
		expect(
			result.categories.find((node) => node.slug === 'ides-code-editors')
		).toMatchObject({
			depth: 2,
			path: EDITORS,
			isLeaf: false,
		})
		expect(
			result.categories
				.filter((node) => node.isLeaf)
				.map((node) => node.path)
				.toSorted()
		).toEqual([AI, GENERAL])
	})

	it('returns only direct leaf badges with current names and paths on project detail', async () => {
		const fixture = await zed()
		const client = clientWith()
		const detail = await client.project.getBySlug({
			params: { slug: fixture.slug },
		})
		expect(getProjectBySlugOutputSchema.parse(detail)).toEqual(detail)
		expect(detail.categoryDetails).toHaveLength(2)
		expect(detail.categoryDetails.map((node) => node.id).toSorted()).toEqual(
			fixture.leaves.map((node) => node.id).toSorted()
		)
		expect(detail.categoryDetails.map((node) => node.path).toSorted()).toEqual([
			AI,
			GENERAL,
		])
		expect(
			detail.categoryDetails.every(
				(node) => node.depth === 3 && node.isLeaf && node.projectCount === 1
			)
		).toBe(true)
		const search = await client.project.search({ query: { category: ROOT } })
		expect(search.projects[0]?.categories.toSorted()).toEqual([
			'ai-powered-editors',
			'general-purpose-editors',
		])
		expect(detail).toMatchObject({
			name: 'Zed',
			github: { stars: 123, forks: 12 },
		})
	})

	it('returns a required empty categoryDetails array for unassigned published projects', async () => {
		const fixture = await zed()
		await database.db
			.delete(projectCategory)
			.where(eq(projectCategory.projectId, fixture.projectId))
		const client = clientWith()
		const detail = await client.project.getBySlug({
			params: { slug: fixture.slug },
		})
		expect(detail.categoryDetails).toEqual([])
		await expect(client.category.list({})).resolves.toEqual({ categories: [] })
		const { categoryDetails, ...missingRequiredField } = detail
		expect(categoryDetails).toEqual([])
		expect(
			getProjectBySlugOutputSchema.safeParse(missingRequiredField).success
		).toBe(false)
	})

	it('keeps draft projects out of all public methods even for signed-in admins', async () => {
		const draft = await zed('draft')
		for (const auth of [null, adminAuth]) {
			const client = clientWith(auth)
			await expect(
				client.project.getBySlug({ params: { slug: draft.slug } })
			).rejects.toMatchObject({ code: 'NOT_FOUND' })
			expect(await client.project.list({ query: {} })).toMatchObject({
				projects: [],
				pagination: { totalItems: 0 },
			})
			for (const categorySlug of [
				undefined,
				ROOT,
				'ides-code-editors',
				'ai-powered-editors',
			]) {
				expect(
					await client.project.search({
						query: { category: categorySlug, q: 'Zed' },
					})
				).toMatchObject({ projects: [], pagination: { totalItems: 0 } })
			}
			expect(await client.category.list({})).toEqual({ categories: [] })
			expect(await client.project.listCategories({})).toEqual({
				categories: [],
			})
			expect(
				await client.category.getByPath({ query: { path: ROOT } })
			).toMatchObject({
				category: { projectCount: 0, isLeaf: false },
				ancestors: [],
				children: [],
			})
		}
	})

	it('allows empty detail, retains actual isLeaf, and hides empty immediate children', async () => {
		const fixture = await zed()
		await database.db
			.delete(projectCategory)
			.where(
				eq(
					projectCategory.categoryId,
					fixture.leaves.find((node) => node.slug === 'ai-powered-editors')!.id
				)
			)
		const client = clientWith()
		const empty = await client.category.getByPath({ query: { path: AI } })
		expect(empty.category).toMatchObject({ projectCount: 0, isLeaf: true })
		expect(empty.children).toEqual([])
		const parent = await client.category.getByPath({ query: { path: EDITORS } })
		expect(parent.category.isLeaf).toBe(false)
		expect(parent.children.map((node) => node.path)).toEqual([GENERAL])
		expect(
			(await client.category.list({})).categories.map((node) => node.path)
		).not.toContain(AI)
		const root = await client.category.getByPath({ query: { path: 'backend' } })
		expect(root).toMatchObject({
			category: { projectCount: 0 },
			ancestors: [],
			children: [],
		})
		expect(typeof root.category.description).toBe('string')
		await database.db
			.update(category)
			.set({ description: null })
			.where(eq(category.slug, 'backend'))
		expect(
			(await client.category.getByPath({ query: { path: 'backend' } })).category
				.description
		).toBeNull()
	})

	it('returns root-first ancestors and immediate children without grandchildren', async () => {
		await zed()
		const client = clientWith()
		const root = await client.category.getByPath({ query: { path: ROOT } })
		expect(root.ancestors).toEqual([])
		expect(root.children.map((node) => node.path)).toEqual([EDITORS])
		const editors = await client.category.getByPath({
			query: { path: EDITORS },
		})
		expect(editors.ancestors.map((node) => node.path)).toEqual([ROOT])
		expect(editors.children.map((node) => node.path)).toEqual([AI, GENERAL])
		const leaf = await client.category.getByPath({ query: { path: GENERAL } })
		expect(leaf.ancestors.map((node) => node.path)).toEqual([ROOT, EDITORS])
		expect(leaf.children).toEqual([])
	})

	it('rejects unknown paths and mismatched ancestry without guessing from the leaf slug', async () => {
		const client = clientWith()
		for (const path of [
			'unknown',
			'ai-powered-editors',
			'backend/ides-code-editors',
			`${ROOT}/ai-powered-editors`,
			`${AI}/`,
			`/${AI}`,
			`${EDITORS}/unknown`,
		]) {
			await expect(
				client.category.getByPath({ query: { path } })
			).rejects.toMatchObject({
				code: 'NOT_FOUND',
			})
		}
		await expect(
			client.category.getByPath({ query: { path: '' } })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
	})

	it('resolves historical paths directly to current ancestry after synthetic rename and reparent', async () => {
		const fixture = await zed()
		const aiLeaf = fixture.leaves.find(
			(node) => node.slug === 'ai-powered-editors'
		)!
		await database.db
			.update(category)
			.set({ slug: 'smart-editors', name: 'Smart Editors' })
			.where(eq(category.id, aiLeaf.id))
		const intermediate = `${EDITORS}/smart-editors`
		await database.db
			.insert(categoryPath)
			.values({ path: intermediate, categoryId: aiLeaf.id })
		const [newRoot] = await database.db
			.insert(category)
			.values({ slug: 'workbench', name: 'Workbench' })
			.returning()
		if (!newRoot) throw new Error('Missing new root')
		await database.db
			.update(category)
			.set({ slug: 'editors', name: 'Editors', parentId: newRoot.id })
			.where(eq(category.slug, 'ides-code-editors'))
		const client = clientWith()
		const currentPath = 'workbench/editors/smart-editors'
		const current = await client.category.getByPath({
			query: { path: currentPath },
		})
		for (const path of [AI, intermediate, currentPath]) {
			expect(await client.category.getByPath({ query: { path } })).toEqual(
				current
			)
		}
		expect(current.category).toMatchObject({
			id: aiLeaf.id,
			name: 'Smart Editors',
			path: currentPath,
		})
		expect(current.ancestors.map((node) => node.path)).toEqual([
			'workbench',
			'workbench/editors',
		])
		const historicalHttp = await rest(
			`/categories/by-path?path=${encodeURIComponent(AI)}`
		)
		expect(historicalHttp.response?.status).toBe(200)
		expect(historicalHttp.response?.headers.has('location')).toBe(false)
		expect(await historicalHttp.response?.json()).toEqual(current)
		expect(
			(await client.category.getByPath({ query: { path: EDITORS } })).category
				.path
		).toBe('workbench/editors')
		expect(
			(
				await client.project.getBySlug({ params: { slug: fixture.slug } })
			).categoryDetails
				.map((node) => node.path)
				.toSorted()
		).toEqual(['workbench/editors/general-purpose-editors', currentPath])
		expect(
			(await client.project.search({ query: { category: 'editors' } }))
				.pagination.totalItems
		).toBe(1)
		expect(
			(
				await client.project.search({
					query: { category: 'ides-code-editors' },
				})
			).pagination.totalItems
		).toBe(0)
		expect(
			(await client.project.search({ query: { category: ROOT } })).pagination
				.totalItems
		).toBe(0)
	})

	it('prefers current hierarchy paths over historical owners while retaining historical fallback', async () => {
		const original = await database.db.query.category.findFirst({
			where: { slug: 'backend' },
		})
		if (!original) throw new Error('Missing original backend category')
		await database.db
			.update(category)
			.set({ slug: 'previous-backend' })
			.where(eq(category.id, original.id))
		await database.db.insert(categoryPath).values({
			path: 'previous-backend',
			categoryId: original.id,
		})
		await database.db
			.update(category)
			.set({ slug: 'current-backend' })
			.where(eq(category.id, original.id))
		const [current] = await database.db
			.insert(category)
			.values({ slug: 'backend', name: 'Current Backend' })
			.returning()
		if (!current) throw new Error('Missing current backend category')

		const client = clientWith()
		const detail = await client.category.getByPath({
			query: { path: 'backend' },
		})
		expect(detail.category).toMatchObject({
			id: current.id,
			path: 'backend',
			name: 'Current Backend',
		})
		const response = await rest('/categories/by-path?path=backend')
		expect(response.response?.status).toBe(200)
		expect(await response.response?.json()).toEqual(detail)
		const canonical = await client.category.getByPath({
			query: {
				path: 'current-backend',
			},
		})
		expect(canonical.category.id).toBe(original.id)
		expect(
			await client.category.getByPath({ query: { path: 'previous-backend' } })
		).toEqual(canonical)
	})

	it('terminates reads for cyclic and over-depth test hierarchies', async () => {
		const fixture = await zed()
		const [fourth] = await database.db
			.insert(category)
			.values({
				slug: 'too-deep',
				name: 'Too deep',
				parentId: fixture.leaves[0]!.id,
			})
			.returning()
		if (!fourth) throw new Error('Missing fourth level')
		await database.db
			.insert(categoryPath)
			.values({ path: 'too-deep-history', categoryId: fourth.id })
		expect(
			(await clientWith().category.list({})).categories.some(
				(node) => node.id === fourth.id
			)
		).toBe(false)
		await expect(
			clientWith().category.getByPath({ query: { path: 'too-deep-history' } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		await database.db
			.update(category)
			.set({ parentId: fixture.leaves[0]!.id })
			.where(eq(category.slug, ROOT))
		const client = clientWith()
		expect(await client.category.list({})).toEqual({ categories: [] })
		await expect(
			client.category.getByPath({ query: { path: AI } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		expect(
			await client.project.search({ query: { category: ROOT } })
		).toMatchObject({
			projects: [],
			pagination: { totalItems: 0 },
		})
		expect(
			(await client.project.getBySlug({ params: { slug: fixture.slug } }))
				.categoryDetails
		).toEqual([])
	})

	it('preserves FTS, stable sort, totals and pagination with sibling assignments and ties', async () => {
		const published = await Promise.all([zed(), zed(), zed()])
		const draft = await zed('draft')
		const ids = published.map((fixture) => fixture.projectId).toSorted()
		await database.db
			.update(project)
			.set({
				createdAt: new Date('2026-01-01T00:00:00Z'),
				tagline: 'qxhierarchyfilter shared search token',
			})
			.where(inArray(project.id, [...ids, draft.projectId]))
		const client = clientWith()
		for (const sort of [
			'newest',
			'oldest',
			'name',
			'most-stars',
			'most-forks',
		] as const) {
			const pages = await Promise.all(
				[1, 2, 3].map((page) =>
					client.project.search({
						query: {
							category: ROOT,
							q: 'qxhierarchyfilter',
							sort,
							page,
							limit: 1,
						},
					})
				)
			)
			const ascending = sort === 'oldest' || sort === 'name'
			expect(
				pages.flatMap((page) => page.projects.map((item) => item.id))
			).toEqual(ascending ? ids : ids.toReversed())
			for (const page of pages) {
				expect(page.pagination).toMatchObject({
					totalItems: 3,
					totalPages: 3,
					limit: 1,
				})
			}
			expect(pages[0]?.pagination).toMatchObject({
				hasNextPage: true,
				hasPreviousPage: false,
			})
			expect(pages[2]?.pagination).toMatchObject({
				hasNextPage: false,
				hasPreviousPage: true,
			})
		}
		expect(
			(await client.category.getByPath({ query: { path: ROOT } })).category
				.projectCount
		).toBe(3)
		expect(
			(
				await client.project.search({
					query: { category: ROOT, q: 'unmatchedtoken' },
				})
			).pagination.totalItems
		).toBe(0)
		expect(
			(await client.project.search({ query: { category: ROOT, q: '   ' } }))
				.pagination.totalItems
		).toBe(3)
		expect(
			await client.project.search({ query: { category: 'unknown', page: 2 } })
		).toMatchObject({
			projects: [],
			pagination: {
				totalItems: 0,
				totalPages: 0,
				hasNextPage: false,
				hasPreviousPage: true,
			},
		})
		await expect(
			client.project.search({ query: { limit: 51 } })
		).rejects.toMatchObject({
			code: 'BAD_REQUEST',
		})
	})

	it('sorts equal category names deterministically and preserves legacy and admin shapes', async () => {
		const fixture = await zed()
		await database.db
			.update(category)
			.set({ name: 'Editors' })
			.where(
				inArray(
					category.id,
					fixture.leaves.map((node) => node.id)
				)
			)
		const frontend = await database.db.query.category.findFirst({
			where: { slug: 'frontend' },
		})
		if (!frontend) throw new Error('Missing frontend')
		await database.db
			.insert(projectCategory)
			.values({ projectId: fixture.projectId, categoryId: frontend.id })
		const client = clientWith()
		const nodes = (await client.category.list({})).categories
		expect(
			nodes.filter((node) => node.name === 'Editors').map((node) => node.slug)
		).toEqual(['ai-powered-editors', 'general-purpose-editors'])
		expect(nodes.map((node) => node.slug)).toContain('frontend')
		expect(nodes.every((node) => node.projectCount === 1)).toBe(true)
		expect(await client.project.listCategories({})).toEqual({
			categories: nodes.map(({ slug, name }) => {
				return { slug, name }
			}),
		})
		const admin = clientWith(adminAuth)
		expect(
			(await admin.admin.project.listCategories({})).categories
		).toHaveLength(10)
		const detail = await admin.admin.project.getById({
			params: { id: fixture.projectId },
		})
		expect(detail.categories.toSorted()).toEqual([
			'ai-powered-editors',
			'frontend',
			'general-purpose-editors',
		])
	})

	it('batches category reads in one SQL query per list, path detail and direct assignments', async () => {
		const fixture = await zed()
		const query = vi.spyOn(database.pool, 'query')
		try {
			const client = clientWith()
			await client.category.list({})
			expect(query).toHaveBeenCalledTimes(1)
			query.mockClear()
			await client.category.getByPath({ query: { path: AI } })
			expect(query).toHaveBeenCalledTimes(1)
			query.mockClear()
			await getDirectProjectCategories(database.db, fixture.projectId)
			expect(query).toHaveBeenCalledTimes(1)
		} finally {
			query.mockRestore()
		}
	})
})

describe('public category HTTP and OpenAPI', () => {
	it('serves the new REST/RPC shapes and keeps legacy RPC available without a REST fallback', async () => {
		const fixture = await zed()
		const list = await rest('/categories')
		expect(list.matched).toBe(true)
		expect(list.response?.status).toBe(200)
		expect(await list.response?.json()).toEqual(
			await clientWith().category.list({})
		)
		const detail = await rest(
			`/categories/by-path?path=${encodeURIComponent(AI)}`
		)
		expect(detail.response?.status).toBe(200)
		expect(await detail.response?.json()).toEqual(
			await clientWith().category.getByPath({ query: { path: AI } })
		)
		for (const [path, input] of [
			['category/list', {}],
			['category/getByPath', { query: { path: AI } }],
			['project/listCategories', {}],
		] as const) {
			const result = await rpc(path, input)
			expect(result.matched).toBe(true)
			expect(result.response?.status).toBe(200)
		}
		expect((await rest('/project/listCategories', null, 'POST')).matched).toBe(
			false
		)
		expect((await rest('/categories', null, 'POST')).matched).toBe(false)
		const search = await rest(`/projects/search?category=${ROOT}&limit=1`)
		expect(search.response?.status).toBe(200)
		expect(await search.response?.json()).toMatchObject({
			projects: [{ id: fixture.projectId }],
			pagination: { totalItems: 1 },
		})
		const projectDetail = await rest(`/projects/${fixture.slug}`)
		expect(projectDetail.response?.status).toBe(200)
		expect(
			getProjectBySlugOutputSchema
				.parse(await projectDetail.response?.json())
				.categoryDetails.map((node) => node.path)
				.toSorted()
		).toEqual([AI, GENERAL])
	})

	it('returns HTTP errors for invalid input, unknown paths and drafts with no admin leak', async () => {
		const draft = await zed('draft')
		for (const auth of [null, adminAuth]) {
			expect(
				(await rest(`/projects/${draft.slug}`, auth)).response?.status
			).toBe(404)
			expect(
				(await rpc('project/getBySlug', { params: { slug: draft.slug } }, auth))
					.response?.status
			).toBe(404)
			expect(await (await rest('/categories', auth)).response?.json()).toEqual({
				categories: [],
			})
			expect(
				await (await rpc('category/list', {}, auth)).response?.json()
			).toMatchObject({ json: { categories: [] } })
		}
		expect(
			(await rest('/categories/by-path?path=backend/ai-powered-editors'))
				.response?.status
		).toBe(404)
		expect(
			(await rpc('category/getByPath', { query: { path: 'unknown' } })).response
				?.status
		).toBe(404)
		expect((await rest('/categories/by-path')).response?.status).toBe(400)
		expect(
			(await rpc('category/getByPath', { query: { path: '' } })).response
				?.status
		).toBe(400)
		expect((await rest('/projects/search?limit=51')).response?.status).toBe(400)
		expect((await rest('/admin/categories')).response?.status).toBe(401)
	})

	it('generates explicit anonymous public operations, one categories QUERY, and protected admin operations', async () => {
		const response = await rest('/spec.json', null, 'GET')
		expect(response.response?.status).toBe(200)
		type Security = Array<Record<string, Array<string>>>
		type Operation = { operationId?: string; security?: Security }
		const spec = (await response.response?.json()) as {
			security: Security
			paths: Record<string, Record<string, Operation>>
			components: {
				securitySchemes: Record<string, { type: string; in: string }>
			}
		}
		expect(spec.security).toEqual([{ apiKeyCookie: [] }])
		expect(spec.components.securitySchemes.apiKeyCookie).toMatchObject({
			type: 'apiKey',
			in: 'cookie',
		})
		for (const path of [
			'/categories',
			'/categories/by-path',
			'/projects',
			'/projects/search',
			'/projects/{slug}',
			'/health',
			'/list-commits',
		]) {
			expect(spec.paths[path]?.query?.security).toEqual([])
		}
		expect(Object.keys(spec.paths['/categories']!)).toEqual(['query'])
		expect(spec.paths['/categories']?.query?.operationId).toBe(
			'listPublicCategories'
		)
		expect(spec.paths['/project/listCategories']).toBeUndefined()
		expect(spec.paths['/category/list']).toBeUndefined()
		expect(
			Object.values(spec.paths)
				.flatMap((operations) => Object.values(operations))
				.filter((operation) => operation.operationId === 'listPublicCategories')
		).toHaveLength(1)
		const adminPaths = Object.entries(spec.paths).filter(([path]) =>
			path.startsWith('/admin/')
		)
		expect(adminPaths.length).toBeGreaterThan(0)
		for (const [, operations] of adminPaths) {
			for (const operation of Object.values(operations)) {
				expect(operation.security ?? spec.security).toEqual([
					{ apiKeyCookie: [] },
				])
			}
		}
	})
})
