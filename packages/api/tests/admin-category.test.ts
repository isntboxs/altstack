import { createRouterClient } from '@orpc/server'
import { eq, sql } from 'drizzle-orm'
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
import { openApiHandler, rpcHandler } from '@altstack/api/handler'
import { routers } from '@altstack/api/routers'
import * as storage from '@altstack/api/storage'

import {
	auditLog,
	category,
	categoryPath,
	project,
	projectCategory,
	user,
} from '@altstack/db/schemas'
import { seedTaxonomy } from '@altstack/db/seed-taxonomy'

import { adminCategoryNodeSchema } from '@altstack/shared/schemas/admin-category'

import { connectTestPostgres } from '../../db/tests/helpers/postgres'

const migrationsFolder = fileURLToPath(
	new URL('../../db/src/migrations', import.meta.url)
)
let postgres: Awaited<ReturnType<typeof connectTestPostgres>> | undefined
let database: Awaited<ReturnType<NonNullable<typeof postgres>['createSchema']>>
let scope: typeof database | undefined
let adminAuth: ORPCContext['auth']
const userAuth = {
	user: { id: crypto.randomUUID(), role: 'user' },
} as unknown as ORPCContext['auth']
const missingId = '550e8400-e29b-41d4-a716-446655440000'

function clientWith(auth = adminAuth) {
	return createRouterClient(routers, { context: { db: database.db, auth } })
}
function createCategory(slug: string, parentId: string | null = null) {
	return clientWith().admin.category.create({
		body: {
			name: slug,
			slug,
			description: `Description of ${slug}`,
			parentId,
		},
	})
}
async function findCategory(slug: string) {
	const row = await database.db.query.category.findFirst({ where: { slug } })
	if (!row) throw new Error(`Missing category ${slug}`)
	return row
}
function projectInput(categorySlugs: Array<string> = ['backend']) {
	const slug = `test-assignment-${crypto.randomUUID()}`
	return {
		name: 'Synthetic assignment',
		slug,
		repositoryUrl: `https://github.com/altstack-test-fixtures/${slug}`,
		tagline: 'Synthetic fixture',
		description: 'Category assignment integrity fixture.',
		logo: `tmp/logos/${slug}-1.png`,
		categorySlugs,
		status: 'draft' as const,
	}
}
async function rest(
	path: string,
	method = 'GET',
	input?: unknown,
	auth = adminAuth
) {
	return openApiHandler.handle(
		new Request(`http://localhost/api/reference${path}`, {
			method,
			...(input === undefined
				? {}
				: {
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify(input),
					}),
		}),
		{ prefix: '/api/reference', context: { db: database.db, auth } }
	)
}
async function rpc(path: string, input: unknown, auth = adminAuth) {
	return rpcHandler.handle(
		new Request(`http://localhost/api/rpc/${path}`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ json: input }),
		}),
		{ prefix: '/api/rpc', context: { db: database.db, auth } }
	)
}

function categoryRpcInput(endpoint: string, input: Record<string, unknown>) {
	const { id, ...body } = input
	if (endpoint === 'list') return {}
	if (endpoint === 'create') return { body }
	if (endpoint === 'update') return { params: { id }, body }
	return { params: { id } }
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
	const [actor] = await database.db
		.insert(user)
		.values({
			name: 'Category admin',
			email: 'category-admin@example.com',
			role: 'admin',
		})
		.returning()
	if (!actor) throw new Error('Missing admin actor')
	adminAuth = {
		user: { id: actor.id, role: 'admin' },
	} as unknown as ORPCContext['auth']
	// Synthetic services only: no GitHub or S3 requests.
	vi.spyOn(octokit.rest.repos, 'get').mockResolvedValue({
		data: { stargazers_count: 10, forks_count: 1 },
	} as unknown as Awaited<ReturnType<typeof octokit.rest.repos.get>>)
	vi.spyOn(storage, 'promoteTempImageToProject').mockImplementation(
		({ slug, kind }) =>
			Promise.resolve(`projects/${slug}/${kind}-${crypto.randomUUID()}.png`)
	)
	vi.spyOn(storage, 'copyS3Object').mockResolvedValue(undefined)
	vi.spyOn(storage, 'deleteFinalKeysBestEffort').mockResolvedValue(undefined)
}, 60_000)
afterEach(async () => {
	vi.restoreAllMocks()
	await scope?.close()
}, 60_000)
afterAll(async () => {
	await postgres?.close()
}, 60_000)

describe('admin category endpoints and compatibility', () => {
	for (const endpoint of [
		'list',
		'getById',
		'create',
		'update',
		'remove',
	] as const) {
		it(`${endpoint}: anonymous 401, user 403, admin REST and HTTP RPC succeed`, async () => {
			const node = await createCategory('endpoint-fixture')
			const input =
				endpoint === 'list'
					? {}
					: endpoint === 'create'
						? {
								name: 'Created',
								slug: 'rest-created',
								description: 'Required description',
								parentId: null,
							}
						: endpoint === 'update'
							? { id: node.id, name: 'Updated' }
							: { id: node.id }
			const path =
				endpoint === 'list' || endpoint === 'create'
					? '/admin/categories'
					: `/admin/categories/${node.id}`
			const method = {
				list: 'GET',
				getById: 'GET',
				create: 'POST',
				update: 'PATCH',
				remove: 'DELETE',
			}[endpoint]
			for (const [auth, status, code] of [
				[null, 401, 'UNAUTHORIZED'],
				[userAuth, 403, 'FORBIDDEN'],
			] as const) {
				const direct = clientWith(auth).admin.category
				await expect(
					direct[endpoint](categoryRpcInput(endpoint, input) as never)
				).rejects.toMatchObject({
					code,
				})
				expect(
					(await rest(path, method, method === 'GET' ? undefined : input, auth))
						.response?.status
				).toBe(status)
				expect(
					(
						await rpc(
							`admin/category/${endpoint}`,
							categoryRpcInput(endpoint, input),
							auth
						)
					).response?.status
				).toBe(status)
			}
			const result = await rest(
				path,
				method,
				method === 'GET' ? undefined : input
			)
			expect(result.matched).toBe(true)
			expect(result.response?.status).toBe(endpoint === 'create' ? 201 : 200)
			const body: unknown = await result.response?.json()
			const expected = {
				list: {
					categories: expect.arrayContaining([
						expect.objectContaining({ id: node.id }),
					]) as unknown,
				},
				getById: { category: { id: node.id }, ancestors: [], children: [] },
				create: {
					name: 'Created',
					description: 'Required description',
					isLeaf: true,
					depth: 1,
				},
				update: { id: node.id, name: 'Updated', slug: node.slug },
				remove: { id: node.id },
			}
			expect(body).toMatchObject(expected[endpoint])
			const rpcInput =
				endpoint === 'create' ? { ...input, slug: 'rpc-created' } : input
			if (endpoint === 'remove') {
				await createCategory('rpc-remove').then((n) => {
					;(rpcInput as { id: string }).id = n.id
				})
			}
			const rpcResult = await rpc(
				`admin/category/${endpoint}`,
				categoryRpcInput(endpoint, rpcInput)
			)
			expect(rpcResult.matched).toBe(true)
			expect(rpcResult.response?.status).toBe(200)
			const rpcBody = (await rpcResult.response?.json()) as { json: unknown }
			expect(rpcBody.json).toMatchObject(
				endpoint === 'remove' ? rpcInput : expected[endpoint]
			)
		})
	}

	it('owns one REST list and retains legacy all-category RPC shape/order with protected OpenAPI operations', async () => {
		const legacy = await clientWith().admin.project.listCategories({})
		expect(legacy.categories).toHaveLength(10)
		expect(legacy.categories.map((n) => n.name)).toEqual(
			legacy.categories.map((n) => n.name).toSorted()
		)
		expect(
			legacy.categories.every(
				(n) => Object.keys(n).toSorted().join() === 'name,slug'
			)
		).toBe(true)
		expect(
			(await rpc('admin/project/listCategories', {})).response?.status
		).toBe(200)
		expect(
			(await rest('/admin/project/listCategories', 'POST', {})).matched
		).toBe(false)
		const spec = (await (await rest('/spec.json')).response?.json()) as {
			security: Array<Record<string, Array<string>>>
			paths: Record<
				string,
				Record<
					string,
					{
						operationId: string
						security?: Array<Record<string, Array<string>>>
					}
				>
			>
		}
		expect(Object.keys(spec.paths['/admin/categories']!).toSorted()).toEqual([
			'get',
			'post',
		])
		expect(
			Object.keys(spec.paths['/admin/categories/{id}']!).toSorted()
		).toEqual(['delete', 'get', 'patch'])
		expect(
			Object.values(spec.paths)
				.flatMap((operations) => Object.values(operations))
				.filter((op) => op.operationId === 'listAdminCategories')
		).toHaveLength(1)
		expect(spec.paths['/admin/project/listCategories']).toBeUndefined()
		for (const path of ['/admin/categories', '/admin/categories/{id}']) {
			for (const op of Object.values(spec.paths[path]!)) {
				expect(op.security ?? spec.security).toEqual([{ apiKeyCookie: [] }])
			}
		}
		expect(spec.paths['/categories']?.get?.security).toEqual([])
	})

	it('returns all nodes/children and all-status direct counts while public counts remain published-only, even for admins', async () => {
		const admin = clientWith()
		const draft = await admin.admin.project.create({
			body: projectInput(['general-purpose-editors', 'ai-powered-editors']),
		})
		await admin.admin.project.create({
			body: {
				...projectInput(['general-purpose-editors', 'ai-powered-editors']),
				status: 'published',
			},
		})
		const query = vi.spyOn(database.pool, 'query')
		const all = await admin.admin.category.list({})
		expect(query).toHaveBeenCalledTimes(1)
		expect(all.categories).toHaveLength(10)
		for (const node of all.categories) {
			expect(adminCategoryNodeSchema.parse(node)).toEqual(node)
		}
		expect(
			all.categories
				.filter((n) => n.slug.endsWith('editors') && n.isLeaf)
				.map((n) => n.directProjectCount)
		).toEqual([2, 2])
		expect(
			all.categories.find((n) => n.slug === 'developer-tools')
		).toMatchObject({ projectCount: 1, directProjectCount: 0 })
		query.mockClear()
		const root = await findCategory('developer-tools')
		query.mockClear()
		const detail = await admin.admin.category.getById({
			params: { id: root.id },
		})
		expect(query).toHaveBeenCalledTimes(1)
		expect(detail.children.map((n) => n.slug)).toEqual(['ides-code-editors'])
		const leaf = await findCategory('ai-powered-editors')
		expect(
			(
				await admin.admin.category.getById({ params: { id: leaf.id } })
			).ancestors.map((n) => n.slug)
		).toEqual(['developer-tools', 'ides-code-editors'])
		expect(await admin.category.list({})).toEqual(
			await clientWith(null).category.list({})
		)
		expect((await admin.category.list({})).categories).toHaveLength(4)
		expect(
			(await admin.category.list({})).categories.every(
				(n) => n.projectCount === 1 && !('directProjectCount' in n)
			)
		).toBe(true)
		await expect(
			admin.project.getBySlug({ params: { slug: draft.slug } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		expect(
			(
				await admin.admin.category.getById({
					params: {
						id: (await findCategory('frontend')).id,
					},
				})
			).children
		).toEqual([])
	})

	it('reports invalid input and missing IDs with HTTP error statuses', async () => {
		expect(
			(
				await rest('/admin/categories', 'POST', {
					name: 'Invalid',
					slug: 'invalid',
					description: ' ',
					parentId: null,
				})
			).response?.status
		).toBe(400)
		for (const method of ['GET', 'PATCH', 'DELETE']) {
			expect(
				(
					await rest(
						`/admin/categories/${missingId}`,
						method,
						method === 'GET' ? undefined : {}
					)
				).response?.status
			).toBe(404)
		}
		expect((await rest('/admin/categories/not-a-uuid')).response?.status).toBe(
			400
		)
	})
})

describe('hierarchy mutation guards', () => {
	it('preserves stored project/category fields when REST PATCH bodies or fields are omitted', async () => {
		const node = await createCategory('patch-omission')
		const created = await clientWith().admin.project.create({
			body: {
				...projectInput(),
				screenshot: 'tmp/screenshots/omission-1.png',
				content: 'Stored content',
				websiteUrl: 'https://example.com',
			},
		})
		vi.mocked(storage.promoteTempImageToProject).mockClear()
		vi.mocked(storage.copyS3Object).mockClear()
		vi.mocked(storage.deleteFinalKeysBestEffort).mockClear()
		for (const body of [undefined, {}, { name: ' Renamed ' }]) {
			const categoryResult = await rest(
				`/admin/categories/${node.id}`,
				'PATCH',
				body
			)
			expect(categoryResult.response?.status).toBe(200)
			expect(await categoryResult.response?.json()).toMatchObject({
				id: node.id,
				slug: node.slug,
				description: node.description,
				parentId: node.parentId,
			})
			const projectResult = await rest(
				`/admin/projects/${created.id}`,
				'PATCH',
				body
			)
			expect(projectResult.response?.status).toBe(200)
			expect(await projectResult.response?.json()).toMatchObject({
				id: created.id,
				slug: created.slug,
				status: 'draft',
				logo: created.logo,
				screenshot: created.screenshot,
				content: 'Stored content',
				websiteUrl: 'https://example.com',
				categories: created.categories,
			})
		}
		expect(storage.promoteTempImageToProject).not.toHaveBeenCalled()
		expect(storage.copyS3Object).not.toHaveBeenCalled()
		expect(
			vi
				.mocked(storage.deleteFinalKeysBestEffort)
				.mock.calls.flatMap(([keys]) => keys)
		).toEqual([])
	})
	it('creates root/child/grandchild with normalization, rejects fourth level and missing parent before writing', async () => {
		const admin = clientWith().admin.category
		const root = await admin.create({
			body: {
				name: '  Root name  ',
				slug: '  A ROOT!  ',
				description: '  Root description  ',
				parentId: null,
			},
		})
		expect(root).toMatchObject({
			name: 'Root name',
			slug: 'a-root',
			description: 'Root description',
			path: 'a-root',
			depth: 1,
			parentId: null,
			isLeaf: true,
			directProjectCount: 0,
		})
		const child = await createCategory('a-child', root.id)
		const grandchild = await createCategory('a-grandchild', child.id)
		expect(grandchild).toMatchObject({
			path: 'a-root/a-child/a-grandchild',
			depth: 3,
			isLeaf: true,
		})
		await expect(createCategory('fourth', grandchild.id)).rejects.toMatchObject(
			{
				code: 'BAD_REQUEST',
				message: expect.stringContaining('3 levels') as unknown,
			}
		)
		await expect(
			createCategory('missing-parent', missingId)
		).rejects.toMatchObject({
			code: 'BAD_REQUEST',
			message: expect.stringContaining('Parent') as unknown,
		})
		expect(
			await database.db.query.category.findFirst({ where: { slug: 'fourth' } })
		).toBeUndefined()
		expect(
			await database.db.query.categoryPath.findFirst({
				where: { path: 'missing-parent' },
			})
		).toBeUndefined()
	})

	it('rejects self-parent, cycles, missing parent, and reparenting a whole subtree beyond depth 3 atomically', async () => {
		const root = await createCategory('guard-root')
		const child = await createCategory('guard-child', root.id)
		const leaf = await createCategory('guard-leaf', child.id)
		const target = await createCategory('guard-target')
		const before = await clientWith().admin.category.list({})
		for (const [id, parentId] of [
			[root.id, root.id],
			[root.id, leaf.id],
			[child.id, leaf.id],
			[root.id, missingId],
			[root.id, target.id],
			[child.id, (await findCategory('ides-code-editors')).id],
		]) {
			await expect(
				clientWith().admin.category.update({
					params: { id: id! },
					body: { parentId: parentId! },
				})
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
			expect(await clientWith().admin.category.list({})).toEqual(before)
		}
		const moved = await clientWith().admin.category.update({
			params: { id: child.id },
			body: { parentId: target.id },
		})
		expect(moved).toMatchObject({ depth: 2, path: 'guard-target/guard-child' })
		expect(
			(await clientWith().admin.category.getById({ params: { id: leaf.id } }))
				.category.depth
		).toBe(3)
		expect(
			await clientWith().admin.category.update({
				params: { id: child.id },
				body: { parentId: target.id, slug: child.slug },
			})
		).toEqual(moved)
	})

	it('edits name/description alone and preserves omitted legacy null without creating paths', async () => {
		const node = await findCategory('backend')
		await database.db
			.update(category)
			.set({ description: null })
			.where(eq(category.id, node.id))
		const beforePaths = await database.db.select().from(categoryPath)
		const renamed = await clientWith().admin.category.update({
			params: { id: node.id },
			body: { name: '  New Backend  ' },
		})
		expect(renamed).toMatchObject({
			name: 'New Backend',
			description: null,
			path: 'backend',
		})
		const described = await clientWith().admin.category.update({
			params: { id: node.id },
			body: { description: '  Better description  ' },
		})
		expect(described.description).toBe('Better description')
		expect(await database.db.select().from(categoryPath)).toEqual(beforePaths)
		await expect(
			clientWith().admin.category.update({
				params: { id: node.id },
				body: { description: ' ' },
			})
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
	})

	it('rejects gaining a child or deleting with draft/published assignments; deletion never removes projects or assignments', async () => {
		const assigned = await createCategory('assigned-root')
		const movable = await createCategory('movable')
		const draft = await clientWith().admin.project.create({
			body: projectInput([assigned.slug]),
		})
		await expect(
			createCategory('new-child', assigned.id)
		).rejects.toMatchObject({
			code: 'CONFLICT',
			message: expect.stringContaining('Reassign') as unknown,
		})
		await expect(
			clientWith().admin.category.update({
				params: { id: movable.id },
				body: { parentId: assigned.id },
			})
		).rejects.toMatchObject({ code: 'CONFLICT' })
		for (const status of [
			'draft',
			'published',
			'rejected',
			'removed',
		] as const) {
			await clientWith().admin.project.update({
				params: { id: draft.id },
				body: { status },
			})
			await expect(
				clientWith().admin.category.remove({ params: { id: assigned.id } })
			).rejects.toMatchObject({
				code: 'CONFLICT',
				message: expect.stringContaining('assignments') as unknown,
			})
		}
		expect(
			await database.db
				.select()
				.from(projectCategory)
				.where(eq(projectCategory.projectId, draft.id))
		).toEqual([{ projectId: draft.id, categoryId: assigned.id }])
		expect(
			await database.db.query.project.findFirst({ where: { id: draft.id } })
		).toBeDefined()
		const parent = await createCategory('delete-parent')
		await createCategory('delete-child', parent.id)
		await expect(
			clientWith().admin.category.remove({ params: { id: parent.id } })
		).rejects.toMatchObject({
			code: 'CONFLICT',
			message: expect.stringContaining('children') as unknown,
		})
	})

	it('deletes only an empty leaf and all its aliases, so old URLs become 404', async () => {
		const leaf = await createCategory('delete-old')
		await clientWith().admin.category.update({
			params: { id: leaf.id },
			body: { slug: 'delete-current' },
		})
		expect(
			await clientWith().admin.category.remove({ params: { id: leaf.id } })
		).toEqual({
			id: leaf.id,
		})
		expect(
			await database.db
				.select()
				.from(categoryPath)
				.where(eq(categoryPath.categoryId, leaf.id))
		).toEqual([])
		for (const path of ['delete-old', 'delete-current']) {
			await expect(
				clientWith(null).category.getByPath({ query: { path } })
			).rejects.toMatchObject({ code: 'NOT_FOUND' })
		}
		expect(
			(await clientWith().admin.category.list({})).categories.some(
				(n) => n.slug === 'backend'
			)
		).toBe(true)
	})
})

describe('subtree canonical paths and history ownership', () => {
	it(
		'renames, reparents, repeats, and reverts an entire subtree with direct stable-ID history and unchanged assignments',
		{ timeout: 30_000 },
		async () => {
			const root = await findCategory('developer-tools')
			const editors = await findCategory('ides-code-editors')
			const leaves = [
				await findCategory('general-purpose-editors'),
				await findCategory('ai-powered-editors'),
			]
			const assigned = await clientWith().admin.project.create({
				body: projectInput(leaves.map((n) => n.slug)),
			})
			const assignmentBefore = await database.db
				.select()
				.from(projectCategory)
				.where(eq(projectCategory.projectId, assigned.id))
			// Exercise PR2's canonical fallback for categories lacking path registrations.
			await database.db.delete(categoryPath)
			const known = new Map<string, Set<string>>()
			async function rememberAndResolve() {
				for (const id of [root.id, editors.id, ...leaves.map((n) => n.id)]) {
					const current = (
						await clientWith().admin.category.getById({ params: { id } })
					).category
					const paths = known.get(id) ?? new Set<string>()
					paths.add(current.path)
					known.set(id, paths)
					for (const path of paths) {
						const resolved = await clientWith(null).category.getByPath({
							query: { path },
						})
						expect(resolved.category).toMatchObject({
							id,
							path: current.path,
							depth: current.depth,
						})
						expect(resolved.ancestors.map((n) => n.depth)).toEqual(
							Array.from({ length: current.depth - 1 }, (_, i) => i + 1)
						)
					}
				}
			}
			await rememberAndResolve()
			await clientWith().admin.category.update({
				params: { id: root.id },
				body: { slug: 'dev-workbench' },
			})
			await rememberAndResolve()
			await clientWith().admin.category.update({
				params: { id: root.id },
				body: { slug: 'dev-tools-new' },
			})
			await rememberAndResolve()
			const target = await createCategory('workbench')
			await clientWith().admin.category.update({
				params: { id: editors.id },
				body: { parentId: target.id },
			})
			await rememberAndResolve()
			await clientWith().admin.category.update({
				params: { id: editors.id },
				body: { parentId: null },
			})
			await rememberAndResolve()
			await clientWith().admin.category.update({
				params: { id: root.id },
				body: { slug: root.slug },
			})
			await clientWith().admin.category.update({
				params: { id: editors.id },
				body: { parentId: root.id },
			})
			await rememberAndResolve()
			for (const [id, paths] of known) {
				for (const path of paths) {
					expect(
						await database.db.query.categoryPath.findFirst({ where: { path } })
					).toEqual({ path, categoryId: id })
				}
			}
			expect(
				await database.db
					.select()
					.from(projectCategory)
					.where(eq(projectCategory.projectId, assigned.id))
			).toEqual(assignmentBefore)
			expect(
				(
					await clientWith().admin.project.getById({
						params: { id: assigned.id },
					})
				).categories.toSorted()
			).toEqual(leaves.map((n) => n.slug).toSorted())
		}
	)

	it('rejects global slug and current/historical ownership conflicts, including descendant paths, without partial writes', async () => {
		const first = await createCategory('owner-one')
		const second = await createCategory('owner-two')
		await expect(createCategory(first.slug, second.id)).rejects.toMatchObject({
			code: 'CONFLICT',
		})
		await expect(
			clientWith().admin.category.update({
				params: { id: second.id },
				body: { slug: first.slug },
			})
		).rejects.toMatchObject({ code: 'CONFLICT' })
		await clientWith().admin.category.update({
			params: { id: first.id },
			body: { slug: 'owner-renamed' },
		})
		await expect(createCategory('owner-one')).rejects.toMatchObject({
			code: 'CONFLICT',
			message: expect.stringContaining('path') as unknown,
		})
		await expect(
			clientWith().admin.category.update({
				params: { id: second.id },
				body: { slug: 'owner-one' },
			})
		).rejects.toMatchObject({ code: 'CONFLICT' })
		const child = await createCategory('owned-child', second.id)
		await database.db
			.insert(categoryPath)
			.values({ path: 'proposed-root/owned-child', categoryId: first.id })
		const before = await database.db.select().from(category)
		const pathsBefore = await database.db.select().from(categoryPath)
		await expect(
			clientWith().admin.category.update({
				params: { id: second.id },
				body: { name: 'Must roll back', slug: 'proposed-root' },
			})
		).rejects.toMatchObject({ code: 'CONFLICT' })
		expect(await database.db.select().from(category)).toEqual(before)
		expect(await database.db.select().from(categoryPath)).toEqual(pathsBefore)
		expect(
			(await clientWith().admin.category.getById({ params: { id: child.id } }))
				.category.path
		).toBe('owner-two/owned-child')
		// A current path without a mapping is still owned and cannot be taken.
		await database.db
			.delete(categoryPath)
			.where(eq(categoryPath.categoryId, first.id))
		await expect(
			clientWith().admin.category.update({
				params: { id: second.id },
				body: { slug: 'owner-renamed' },
			})
		).rejects.toMatchObject({ code: 'CONFLICT' })
	})
})

describe('project direct leaf assignment integrity and promotion cleanup', () => {
	it('accepts two editor leaves plus a legacy root, deduplicates, stores no ancestors, and preserves omitted assignments', async () => {
		const slugs = ['general-purpose-editors', 'ai-powered-editors', 'backend']
		const created = await clientWith().admin.project.create({
			body: projectInput([
				slugs[0]!,
				slugs[1]!,
				slugs[0]!,
				slugs[2]!,
				' backend ',
			]),
		})
		expect(created.categories).toEqual(slugs)
		const assignments = await database.db
			.select()
			.from(projectCategory)
			.where(eq(projectCategory.projectId, created.id))
		expect(assignments).toHaveLength(3)
		const ancestor = await findCategory('developer-tools')
		expect(assignments.some((a) => a.categoryId === ancestor.id)).toBe(false)
		await clientWith().admin.project.update({
			params: { id: created.id },
			body: { name: 'New project name' },
		})
		expect(
			await database.db
				.select()
				.from(projectCategory)
				.where(eq(projectCategory.projectId, created.id))
		).toEqual(assignments)
		const updated = await clientWith().admin.project.update({
			params: { id: created.id },
			body: { categorySlugs: ['frontend', 'frontend'] },
		})
		expect(updated.categories).toEqual(['frontend'])
		expect(
			await database.db
				.select()
				.from(projectCategory)
				.where(eq(projectCategory.projectId, created.id))
		).toHaveLength(1)
	})

	it('rejects nonexistent/nonleaf categories and empty/over-limit distinct assignments before external image work', async () => {
		const created = await clientWith().admin.project.create({
			body: projectInput(),
		})
		vi.mocked(storage.promoteTempImageToProject).mockClear()
		vi.mocked(octokit.rest.repos.get).mockClear()
		for (const categorySlugs of [
			['unknown'],
			['developer-tools'],
			['ides-code-editors'],
			[],
			['backend', 'frontend', 'devops', 'mobile'],
		]) {
			await expect(
				clientWith().admin.project.create({ body: projectInput(categorySlugs) })
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
			await expect(
				clientWith().admin.project.update({
					params: { id: created.id },
					body: { categorySlugs, logo: projectInput().logo },
				})
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		}
		expect(storage.promoteTempImageToProject).not.toHaveBeenCalled()
		expect(octokit.rest.repos.get).not.toHaveBeenCalled()
	})

	it('revalidates create after promotion, rolling back project/audit/assignments and cleaning every consumed image', async () => {
		const leaf = await createCategory('create-race-leaf')
		const input = {
			...projectInput([leaf.slug]),
			screenshot: `tmp/screenshots/${crypto.randomUUID()}-1.png`,
		}
		const finals = [
			`projects/${input.slug}/logo-final.png`,
			`projects/${input.slug}/screenshot-final.png`,
		]
		vi.mocked(storage.promoteTempImageToProject)
			.mockImplementationOnce(async () => {
				await createCategory('create-race-child', leaf.id)
				return finals[0]!
			})
			.mockResolvedValueOnce(finals[1]!)
		await expect(
			clientWith().admin.project.create({ body: input })
		).rejects.toMatchObject({ code: 'UPLOAD_CONSUMED' })
		expect(storage.deleteFinalKeysBestEffort).toHaveBeenCalledWith(finals)
		expect(
			await database.db.query.project.findFirst({ where: { slug: input.slug } })
		).toBeUndefined()
		expect(await database.db.select().from(auditLog)).toEqual([])
		expect(await database.db.select().from(projectCategory)).toEqual([])
	})

	it('revalidates update after promotion and retains old project/images/audit/assignments when a selected leaf becomes a parent', async () => {
		const created = await clientWith().admin.project.create({
			body: projectInput(),
		})
		const leaf = await createCategory('update-race-leaf')
		const before = await database.db.query.project.findFirst({
			where: { id: created.id },
		})
		const assignments = await database.db.select().from(projectCategory)
		const audits = await database.db.select().from(auditLog)
		vi.mocked(storage.deleteFinalKeysBestEffort).mockClear()
		const final = `projects/${created.slug}/logo-replacement.png`
		vi.mocked(storage.promoteTempImageToProject).mockImplementationOnce(
			async () => {
				await createCategory('update-race-child', leaf.id)
				return final
			}
		)
		await expect(
			clientWith().admin.project.update({
				params: { id: created.id },
				body: {
					name: 'Must roll back',
					logo: projectInput().logo,
					categorySlugs: [leaf.slug],
				},
			})
		).rejects.toMatchObject({ code: 'UPLOAD_CONSUMED' })
		expect(storage.deleteFinalKeysBestEffort).toHaveBeenCalledWith([final])
		expect(storage.deleteFinalKeysBestEffort).not.toHaveBeenCalledWith([
			created.logo,
		])
		expect(
			await database.db.query.project.findFirst({ where: { id: created.id } })
		).toEqual(before)
		expect(await database.db.select().from(projectCategory)).toEqual(
			assignments
		)
		expect(await database.db.select().from(auditLog)).toEqual(audits)
	})
})

function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((done) => {
		resolve = done
	})
	return { promise, resolve }
}
function settled<T>(promise: Promise<T>) {
	return promise.then(
		(value) => {
			return { status: 'fulfilled' as const, value }
		},
		(reason: unknown) => {
			return { status: 'rejected' as const, reason }
		}
	)
}

// Pause the first real API transaction after its writes but before COMMIT.
// The second API runs on a separate connection; pg_blocking_pids proves that
// its advisory lock waits on the first, then authoritative checks see the commit.
async function serializedRace(
	firstOperation: () => Promise<unknown>,
	secondOperation: () => Promise<unknown>,
	secondCode: string
) {
	const original = database.db.transaction.bind(database.db)
	const written = deferred<number>()
	const secondStarted = deferred<number>()
	const release = deferred<void>()
	let call = 0
	const spy = vi
		.spyOn(database.db, 'transaction')
		.mockImplementation((callback, config) => {
			const sequence = call++
			return original(async (tx) => {
				const pid = (
					await tx.execute<{ pid: number }>(sql`SELECT pg_backend_pid() AS pid`)
				).rows[0]!.pid
				if (sequence === 1) secondStarted.resolve(pid)
				const result = await callback(tx)
				if (sequence === 0) {
					written.resolve(pid)
					await release.promise
				}
				return result
			}, config)
		})
	let first: ReturnType<typeof settled> | undefined
	let second: ReturnType<typeof settled> | undefined
	try {
		first = settled(firstOperation())
		const firstPid = await Promise.race([
			written.promise,
			first.then((result) => {
				throw new Error(`First transaction failed: ${JSON.stringify(result)}`)
			}),
		])
		second = settled(secondOperation())
		const secondPid = await Promise.race([
			secondStarted.promise,
			second.then((result) => {
				throw new Error(
					`Second operation never reached transaction: ${JSON.stringify(result)}`
				)
			}),
		])
		expect(secondPid).not.toBe(firstPid)
		let blocked = false
		const deadline = Date.now() + 5_000
		while (!blocked && Date.now() < deadline) {
			blocked = (
				await database.pool.query<{ blocked: boolean }>(
					'SELECT $1::integer = ANY(pg_blocking_pids($2::integer)) AS blocked',
					[firstPid, secondPid]
				)
			).rows[0]!.blocked
			if (!blocked) await new Promise((resolve) => setTimeout(resolve, 20))
		}
		expect(blocked).toBe(true)
		release.resolve()
		expect(await first).toMatchObject({ status: 'fulfilled' })
		expect(await second).toMatchObject({
			status: 'rejected',
			reason: { code: secondCode },
		})
	} finally {
		release.resolve()
		await Promise.all([first, second])
		spy.mockRestore()
	}
	// A child-bearing category must never have any direct assignment.
	const invalid = await database.db.execute(
		sql`SELECT assignment.* FROM project_categories assignment JOIN categories child ON child.parent_id = assignment.category_id`
	)
	expect(invalid.rows).toEqual([])
}

describe('controlled concurrent API writes on separate PostgreSQL connections', () => {
	it('assign then add child: waiting create rejects the now-assigned parent', async () => {
		const leaf = await createCategory('assign-first')
		await serializedRace(
			() =>
				clientWith().admin.project.create({ body: projectInput([leaf.slug]) }),
			() => createCategory('assign-first-child', leaf.id),
			'CONFLICT'
		)
		expect(
			await database.db.query.category.findFirst({
				where: { slug: 'assign-first-child' },
			})
		).toBeUndefined()
	})
	it('add child then assign: waiting project create revalidates leaf and cleans promoted images', async () => {
		const leaf = await createCategory('child-first')
		await serializedRace(
			() => createCategory('child-first-child', leaf.id),
			() =>
				clientWith().admin.project.create({ body: projectInput([leaf.slug]) }),
			'UPLOAD_CONSUMED'
		)
		expect(storage.deleteFinalKeysBestEffort).toHaveBeenCalledWith([
			expect.stringContaining('/logo-') as unknown,
		])
		expect(await database.db.select().from(project)).toEqual([])
	})
	it('assign then delete: waiting remove rejects the new draft assignment', async () => {
		const leaf = await createCategory('assign-delete')
		await serializedRace(
			() =>
				clientWith().admin.project.create({ body: projectInput([leaf.slug]) }),
			() => clientWith().admin.category.remove({ params: { id: leaf.id } }),
			'CONFLICT'
		)
		expect(
			await database.db.query.category.findFirst({ where: { id: leaf.id } })
		).toBeDefined()
	})
	it('delete then assign: waiting project update returns BAD_REQUEST without uploads and preserves existing assignments', async () => {
		const leaf = await createCategory('delete-assign')
		const existing = await clientWith().admin.project.create({
			body: projectInput(),
		})
		const before = await database.db.select().from(projectCategory)
		await serializedRace(
			() => clientWith().admin.category.remove({ params: { id: leaf.id } }),
			() =>
				clientWith().admin.project.update({
					params: { id: existing.id },
					body: { categorySlugs: [leaf.slug] },
				}),
			'BAD_REQUEST'
		)
		expect(await database.db.select().from(projectCategory)).toEqual(before)
	})
	it('conflicting path edits: the waiting rename rejects ownership reserved by the first commit', async () => {
		const first = await createCategory('race-owner-one')
		const second = await createCategory('race-owner-two')
		await serializedRace(
			() =>
				clientWith().admin.category.update({
					params: { id: first.id },
					body: { slug: 'race-shared' },
				}),
			() =>
				clientWith().admin.category.update({
					params: { id: second.id },
					body: { slug: 'race-shared' },
				}),
			'CONFLICT'
		)
		expect(
			await database.db.query.categoryPath.findFirst({
				where: { path: 'race-shared' },
			})
		).toEqual({ path: 'race-shared', categoryId: first.id })
		expect(
			(await clientWith().admin.category.getById({ params: { id: second.id } }))
				.category.slug
		).toBe(second.slug)
	})
	it('rename then claim the freed slug: the waiting update rejects the newly historical path', async () => {
		const first = await createCategory('history-race-first')
		const second = await createCategory('history-race-second')
		await serializedRace(
			() =>
				clientWith().admin.category.update({
					params: { id: first.id },
					body: { slug: 'history-race-new' },
				}),
			() =>
				clientWith().admin.category.update({
					params: { id: second.id },
					body: { slug: first.slug },
				}),
			'CONFLICT'
		)
		expect(
			(
				await clientWith(null).category.getByPath({
					query: { path: first.slug },
				})
			).category
		).toMatchObject({ id: first.id, path: 'history-race-new' })
		expect(
			(await clientWith().admin.category.getById({ params: { id: second.id } }))
				.category.slug
		).toBe(second.slug)
	})
	it('opposite reparent edits: the waiting update detects a cycle against the committed hierarchy', async () => {
		const first = await createCategory('race-parent-one')
		const second = await createCategory('race-parent-two')
		await serializedRace(
			() =>
				clientWith().admin.category.update({
					params: { id: first.id },
					body: { parentId: second.id },
				}),
			() =>
				clientWith().admin.category.update({
					params: { id: second.id },
					body: { parentId: first.id },
				}),
			'BAD_REQUEST'
		)
		expect(
			(await clientWith().admin.category.getById({ params: { id: first.id } }))
				.category.parentId
		).toBe(second.id)
		expect(
			(await clientWith().admin.category.getById({ params: { id: second.id } }))
				.category.parentId
		).toBeNull()
	})
})
