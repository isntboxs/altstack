import { SmartCoercionHandlerPlugin } from '@orpc/json-schema'
import { getOpenAPIMeta, OpenAPIGenerator } from '@orpc/openapi'
import { OpenAPIHandler } from '@orpc/openapi/fetch'
import { createRouterClient, implement } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { ZodToJsonSchemaConverter } from '@orpc/zod'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { contracts } from '@altstack/api/contracts'

import baseline from './fixtures/openapi-wire-contract.json'

const ID = '550e8400-e29b-41d4-a716-446655440000'
const LOGO = 'tmp/logos/example-1.png'
const SCREENSHOT = 'tmp/screenshots/example-1.png'
const node = {
	id: ID,
	parentId: null,
	slug: 'backend',
	name: 'Backend',
	description: null,
	path: 'backend',
	depth: 1,
	isLeaf: true,
	projectCount: 1,
}
const adminNode = { ...node, directProjectCount: 1 }
const project = {
	id: ID,
	name: 'Example',
	slug: 'example',
	tagline: 'Example project',
	description: 'Example description',
	logo: `projects/example/logo-${ID}.png`,
	screenshot: null,
	repositoryUrl: 'https://github.com/example/project',
	websiteUrl: null,
	content: null,
	status: 'published' as const,
	createdAt: new Date('2026-01-01T00:00:00Z'),
	updatedAt: new Date('2026-01-01T00:00:00Z'),
	github: {
		owner: 'example',
		repo: 'project',
		stars: 10,
		forks: 1,
		fetchedAt: new Date('2026-01-01T00:00:00Z'),
	},
}
const pagination = {
	page: 1,
	limit: 12,
	totalItems: 0,
	totalPages: 0,
	hasNextPage: false,
	hasPreviousPage: false,
}
const responses = {
	listAdminCategories: { categories: [adminNode] },
	getAdminCategoryById: { category: adminNode, ancestors: [], children: [] },
	createAdminCategory: adminNode,
	updateAdminCategory: adminNode,
	removeAdminCategory: { id: ID },
	createAdminProject: { ...project, categories: ['backend'] },
	getAdminProjectById: { ...project, categories: ['backend'] },
	updateAdminProject: { ...project, categories: ['backend'] },
	deleteAdminProject: { success: true as const },
	listAdminProjects: { projects: [], pagination },
	requestLogoUpload: { key: LOGO, presignedUrl: 'https://storage.test/logo' },
	removeLogoUpload: { success: true as const },
	changeLogoUpload: { success: true as const },
	requestScreenshotUpload: {
		key: SCREENSHOT,
		presignedUrl: 'https://storage.test/screenshot',
	},
	removeScreenshotUpload: { success: true as const },
	changeScreenshotUpload: { success: true as const },
	getCommits: [],
	listPublicCategories: { categories: [node] },
	getCategoryByPath: { category: node, ancestors: [], children: [] },
	checkHealth: { message: 'OK' },
	getProjectBySlug: { ...project, categoryDetails: [node] },
	listProjects: { projects: [], pagination },
	searchProjects: { projects: [], pagination },
}
const observed = vi.fn<(operationId: string, input: unknown) => void>()
function record<T>(operationId: string, input: unknown, output: T) {
	observed(operationId, input)
	return output
}

// Exercise the real contracts and codecs without database, GitHub, or S3 writes.
const o = implement(contracts)
const probes = {
	admin: {
		category: {
			list: o.admin.category.list.handler(({ input }) =>
				record('listAdminCategories', input, responses.listAdminCategories)
			),
			getById: o.admin.category.getById.handler(({ input }) =>
				record('getAdminCategoryById', input, responses.getAdminCategoryById)
			),
			create: o.admin.category.create.handler(({ input }) =>
				record('createAdminCategory', input, responses.createAdminCategory)
			),
			update: o.admin.category.update.handler(({ input }) =>
				record('updateAdminCategory', input, responses.updateAdminCategory)
			),
			remove: o.admin.category.remove.handler(({ input }) =>
				record('removeAdminCategory', input, responses.removeAdminCategory)
			),
		},
		project: {
			create: o.admin.project.create.handler(({ input }) =>
				record('createAdminProject', input, responses.createAdminProject)
			),
			getById: o.admin.project.getById.handler(({ input }) =>
				record('getAdminProjectById', input, responses.getAdminProjectById)
			),
			update: o.admin.project.update.handler(({ input }) =>
				record('updateAdminProject', input, responses.updateAdminProject)
			),
			remove: o.admin.project.remove.handler(({ input }) =>
				record('deleteAdminProject', input, responses.deleteAdminProject)
			),
			list: o.admin.project.list.handler(({ input }) =>
				record('listAdminProjects', input, responses.listAdminProjects)
			),
			listCategories: o.admin.project.listCategories.handler(({ input }) =>
				record('legacyAdminCategories', input, {
					categories: [{ slug: node.slug, name: node.name }],
				})
			),
		},
		upload: {
			logo: {
				request: o.admin.upload.logo.request.handler(({ input }) =>
					record('requestLogoUpload', input, responses.requestLogoUpload)
				),
				remove: o.admin.upload.logo.remove.handler(({ input }) =>
					record('removeLogoUpload', input, responses.removeLogoUpload)
				),
				change: o.admin.upload.logo.change.handler(({ input }) =>
					record('changeLogoUpload', input, responses.changeLogoUpload)
				),
			},
			screenshot: {
				request: o.admin.upload.screenshot.request.handler(({ input }) =>
					record(
						'requestScreenshotUpload',
						input,
						responses.requestScreenshotUpload
					)
				),
				remove: o.admin.upload.screenshot.remove.handler(({ input }) =>
					record(
						'removeScreenshotUpload',
						input,
						responses.removeScreenshotUpload
					)
				),
				change: o.admin.upload.screenshot.change.handler(({ input }) =>
					record(
						'changeScreenshotUpload',
						input,
						responses.changeScreenshotUpload
					)
				),
			},
		},
	},
	altstack: {
		listCommits: o.altstack.listCommits.handler(() => responses.getCommits),
	},
	category: {
		list: o.category.list.handler(({ input }) =>
			record('listPublicCategories', input, responses.listPublicCategories)
		),
		getByPath: o.category.getByPath.handler(({ input }) =>
			record('getCategoryByPath', input, responses.getCategoryByPath)
		),
	},
	health: o.health.handler(() => responses.checkHealth),
	project: {
		getBySlug: o.project.getBySlug.handler(({ input }) =>
			record('getProjectBySlug', input, responses.getProjectBySlug)
		),
		list: o.project.list.handler(({ input }) =>
			record('listProjects', input, responses.listProjects)
		),
		search: o.project.search.handler(({ input }) =>
			record('searchProjects', input, responses.searchProjects)
		),
		listCategories: o.project.listCategories.handler(({ input }) =>
			record('legacyPublicCategories', input, {
				categories: [{ slug: node.slug, name: node.name }],
			})
		),
	},
}
const handler = new OpenAPIHandler(probes, {
	filter: (procedure) => getOpenAPIMeta(procedure)?.path !== undefined,
	plugins: [
		new SmartCoercionHandlerPlugin({
			converters: [new ZodToJsonSchemaConverter()],
		}),
	],
})
async function rest(path: string, method = 'GET', body?: unknown) {
	return handler.handle(
		new Request(`http://localhost${path}`, {
			method,
			...(body === undefined
				? {}
				: {
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify(body),
					}),
		}),
		{ context: {} }
	)
}

const categoryBody = {
	name: ' Backend ',
	slug: 'Backend Tools',
	description: ' API tools ',
	parentId: null,
}
const projectBody = {
	name: ' Example ',
	slug: 'Example Project',
	repositoryUrl: 'Example/Project.git',
	tagline: ' Tagline ',
	description: ' Description ',
	logo: LOGO,
	categorySlugs: [' backend ', 'backend'],
}
interface MappingCase {
	operationId: keyof typeof responses
	path: string
	method?: string
	body?: unknown
	input?: unknown
	status?: number
}
const cases: Array<MappingCase> = [
	{ operationId: 'listAdminCategories', path: '/admin/categories', input: {} },
	{
		operationId: 'getAdminCategoryById',
		path: `/admin/categories/${ID}?id=ignored`,
		input: { params: { id: ID } },
	},
	{
		operationId: 'createAdminCategory',
		path: '/admin/categories',
		method: 'POST',
		body: categoryBody,
		input: {
			body: {
				name: 'Backend',
				slug: 'backend-tools',
				description: 'API tools',
				parentId: null,
			},
		},
		status: 201,
	},
	{
		operationId: 'updateAdminCategory',
		path: `/admin/categories/${ID}`,
		method: 'PATCH',
		body: { id: 'ignored', name: ' Renamed ' },
		input: { params: { id: ID }, body: { name: 'Renamed' } },
	},
	{
		operationId: 'removeAdminCategory',
		path: `/admin/categories/${ID}`,
		method: 'DELETE',
		input: { params: { id: ID } },
	},
	{
		operationId: 'createAdminProject',
		path: '/admin/projects',
		method: 'POST',
		body: projectBody,
		input: {
			body: {
				name: 'Example',
				slug: 'example-project',
				repositoryUrl: 'https://github.com/example/project',
				tagline: 'Tagline',
				description: 'Description',
				logo: LOGO,
				categorySlugs: ['backend'],
				status: 'published',
			},
		},
		status: 201,
	},
	{
		operationId: 'getAdminProjectById',
		path: `/admin/projects/${ID}`,
		input: { params: { id: ID } },
	},
	{
		operationId: 'updateAdminProject',
		path: `/admin/projects/${ID}?status=draft`,
		method: 'PATCH',
		body: {
			id: 'ignored',
			screenshot: null,
			repositoryUrl: 'Example/Project.git',
		},
		input: {
			params: { id: ID },
			body: {
				screenshot: null,
				repositoryUrl: 'https://github.com/example/project',
			},
		},
	},
	{
		operationId: 'deleteAdminProject',
		path: `/admin/projects/${ID}`,
		method: 'DELETE',
		input: { params: { id: ID } },
	},
	{
		operationId: 'listAdminProjects',
		path: '/admin/projects?status=draft&name=Foo%20%25_bar&sort=name&order=asc&page=2&limit=3',
		input: {
			query: {
				status: 'draft',
				name: 'Foo %_bar',
				sort: 'name',
				order: 'asc',
				page: 2,
				limit: 3,
			},
		},
	},
	{
		operationId: 'requestLogoUpload',
		path: '/admin/uploads/logo',
		method: 'POST',
		body: { filename: ' Logo.png ', contentType: 'image/png', size: '2048' },
		input: {
			body: { filename: 'Logo.png', contentType: 'image/png', size: 2048 },
		},
	},
	{
		operationId: 'removeLogoUpload',
		path: '/admin/uploads/logo',
		method: 'DELETE',
		body: { key: LOGO },
		input: { body: { key: LOGO } },
	},
	{
		operationId: 'changeLogoUpload',
		path: '/admin/uploads/logo/change',
		method: 'POST',
		body: { oldKey: LOGO, newKey: LOGO },
		input: { body: { oldKey: LOGO, newKey: LOGO } },
	},
	{
		operationId: 'requestScreenshotUpload',
		path: '/admin/uploads/screenshot',
		method: 'POST',
		body: {
			filename: ' Screenshot.png ',
			contentType: 'image/png',
			size: 2048,
		},
		input: {
			body: {
				filename: 'Screenshot.png',
				contentType: 'image/png',
				size: 2048,
			},
		},
	},
	{
		operationId: 'removeScreenshotUpload',
		path: '/admin/uploads/screenshot',
		method: 'DELETE',
		body: { key: SCREENSHOT },
		input: { body: { key: SCREENSHOT } },
	},
	{
		operationId: 'changeScreenshotUpload',
		path: '/admin/uploads/screenshot/change',
		method: 'POST',
		body: { oldKey: SCREENSHOT, newKey: SCREENSHOT },
		input: { body: { oldKey: SCREENSHOT, newKey: SCREENSHOT } },
	},
	{ operationId: 'getCommits', path: '/list-commits' },
	{
		operationId: 'listPublicCategories',
		path: '/categories?unused=ignored',
		input: {},
	},
	{
		operationId: 'getCategoryByPath',
		path: '/categories/by-path?path=tools%2Feditors%2Fcode',
		input: { query: { path: 'tools/editors/code' } },
	},
	{ operationId: 'checkHealth', path: '/health?unused=ignored' },
	{
		operationId: 'getProjectBySlug',
		path: '/projects/Example%20Project',
		input: { params: { slug: 'example-project' } },
	},
	{
		operationId: 'listProjects',
		path: '/projects?page=2&limit=3',
		input: { query: { page: 2, limit: 3 } },
	},
	{
		operationId: 'searchProjects',
		path: '/projects/search?q=%20hello%20%26%20world%20&category=backend&sort=most-stars&page=2&limit=3',
		input: {
			query: {
				q: 'hello & world',
				category: 'backend',
				sort: 'most-stars',
				page: 2,
				limit: 3,
			},
		},
	},
]

beforeEach(() => observed.mockClear())

describe('detailed REST mapping', () => {
	it.each(cases)(
		'$operationId preserves its wire input, compact response, and status',
		async ({ operationId, path, method, body, input, status }) => {
			const result = await rest(path, method, body)
			expect(result.matched).toBe(true)
			expect(result.response?.status).toBe(status ?? 200)
			expect(await result.response?.json()).toEqual(
				JSON.parse(JSON.stringify(responses[operationId])) as unknown
			)
			expect(observed.mock.calls).toEqual(
				input === undefined ? [] : [[operationId, input]]
			)
		}
	)
	it.each(['/admin/categories', '/admin/projects'])(
		'PATCH %s separates the path ID and preserves omission, null, and absent bodies',
		async (path) => {
			for (const body of [
				undefined,
				{},
				{ parentId: null },
				{ screenshot: null },
			]) {
				observed.mockClear()
				expect(
					(await rest(`${path}/${ID}`, 'PATCH', body)).response?.status
				).toBe(200)
				const expectedBody = path.endsWith('categories')
					? body && 'parentId' in body
						? { parentId: null }
						: {}
					: body && 'screenshot' in body
						? { screenshot: null }
						: {}
				expect(observed.mock.calls[0]?.[1]).toEqual({
					params: { id: ID },
					body: body === undefined ? undefined : expectedBody,
				})
			}
		}
	)
	it('preserves defaults, scalar repeated-query encoding, and blank-search normalization', async () => {
		await rest('/projects')
		expect(observed).toHaveBeenLastCalledWith('listProjects', {
			query: { page: 1, limit: 12 },
		})
		await rest('/projects/search?page=1&page=2&q=%20%20')
		expect(observed).toHaveBeenLastCalledWith('searchProjects', {
			query: { q: undefined, sort: 'newest', page: 2, limit: 12 },
		})
		await rest('/admin/projects')
		expect(observed).toHaveBeenLastCalledWith('listAdminProjects', {
			query: { sort: 'createdAt', order: 'desc', page: 1, limit: 12 },
		})
	})
	it.each([
		['/categories/by-path', 'GET', undefined],
		['/categories/by-path?path=', 'GET', undefined],
		['/projects/search?sort=invalid', 'GET', undefined],
		['/projects?page=0', 'GET', undefined],
		['/projects?limit=51', 'GET', undefined],
		['/admin/projects?page=NaN', 'GET', undefined],
		['/admin/categories/not-a-uuid', 'PATCH', {}],
		[`/admin/projects/${ID}`, 'PATCH', { status: 'invalid' }],
		[`/admin/projects/${ID}`, 'PATCH', { categorySlugs: [] }],
		['/admin/projects', 'POST', {}],
		[
			'/admin/uploads/logo',
			'POST',
			{ filename: 'x.png', contentType: 'image/png', size: 0 },
		],
		['/admin/uploads/screenshot', 'DELETE', { key: LOGO }],
	] as const)(
		'rejects invalid %s %s input before invoking the handler',
		async (path, method, body) => {
			const result = await rest(path, method, body)
			expect(result.response?.status).toBe(400)
			expect(await result.response?.json()).toMatchObject({
				code: 'BAD_REQUEST',
			})
			expect(observed).not.toHaveBeenCalled()
		}
	)
	it('uses the detailed RPC shapes while retaining flat compatibility procedures and no-input calls', async () => {
		const client = createRouterClient(probes, { context: {} })
		await client.project.search({ query: { page: '2', q: ' test ' } })
		expect(observed).toHaveBeenLastCalledWith('searchProjects', {
			query: { page: 2, limit: 12, sort: 'newest', q: 'test' },
		})
		await client.admin.project.update({
			params: { id: ID },
			body: { screenshot: null },
		})
		expect(observed).toHaveBeenLastCalledWith('updateAdminProject', {
			params: { id: ID },
			body: { screenshot: null },
		})
		for (const procedure of [
			client.project.listCategories,
			client.admin.project.listCategories,
		]) {
			expect(await procedure({})).toEqual({
				categories: [{ slug: 'backend', name: 'Backend' }],
			})
			expect(observed.mock.calls.at(-1)?.[1]).toEqual({})
		}
		expect(await client.health()).toEqual({ message: 'OK' })
		expect(await client.altstack.listCommits()).toEqual([])
		for (const path of [
			'/project/listCategories',
			'/admin/project/listCategories',
		]) {
			expect((await rest(path, 'POST', {})).matched).toBe(false)
		}
	})
	it('validates detailed inputs through the serialized RPC transport', async () => {
		const rpcHandler = new RPCHandler(probes)
		for (const [path, input, status] of [
			['project/search', { query: { page: '2' } }, 200],
			[
				'admin/project/update',
				{ params: { id: ID }, body: { screenshot: null } },
				200,
			],
			['project/listCategories', {}, 200],
			['admin/project/listCategories', {}, 200],
			['project/search', { page: 2 }, 400],
		] as const) {
			const result = await rpcHandler.handle(
				new Request(`http://localhost/rpc/${path}`, {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ json: input }),
				}),
				{ context: {}, prefix: '/rpc' }
			)
			expect(result.matched).toBe(true)
			expect(result.response?.status).toBe(status)
		}
	})
})

describe('generated OpenAPI compatibility', () => {
	it('matches the pre-migration wire contract for every operation, including parameters, bodies, errors, and security', async () => {
		const spec = await new OpenAPIGenerator({
			converters: [new ZodToJsonSchemaConverter()],
		}).generate(contracts, {
			filter: (procedure) => getOpenAPIMeta(procedure)?.path !== undefined,
			base: {
				info: { title: 'Altstack API', version: '0.0.0' },
				security: baseline.security,
				components: {
					securitySchemes: {
						apiKeyCookie: {
							type: 'apiKey',
							in: 'cookie',
							name: 'better-auth.session_token',
						},
					},
				},
			},
		})
		const paths = spec.paths ?? {}
		const operations = Object.keys(paths)
			.filter((path): path is `/${string}` => path.startsWith('/'))
			.flatMap((path) =>
				(['get', 'post', 'patch', 'delete'] as const).flatMap((method) => {
					const operation = paths[path]?.[method]
					return operation ? [{ path, method, operation }] : []
				})
			)
		expect(operations).toHaveLength(23)
		for (const [operationId, expected] of Object.entries(baseline.operations)) {
			const actual = operations.find(
				({ operation }) => operation.operationId === operationId
			)
			expect(actual).toBeDefined()
			expect(actual?.path).toBe(expected.path)
			expect(actual?.method).toBe(expected.method)
			expect(actual?.operation.parameters ?? []).toEqual(expected.parameters)
			expect(actual?.operation.requestBody ?? null).toEqual(
				expected.requestBody
			)
			expect(actual?.operation.security ?? spec.security).toEqual(
				expected.security
			)
			const successResponses = Object.fromEntries(
				Object.entries(expected.responses).map(([status, response]) => [
					status,
					{
						...response,
						content: {
							'application/json': {
								schema:
									baseline.responseSchemas[
										response.content['application/json']
											.schema as keyof typeof baseline.responseSchemas
									],
							},
						},
					},
				])
			)
			expect(actual?.operation.responses).toEqual({
				...baseline.errorResponses,
				...successResponses,
			})
		}
		expect(spec.security).toEqual(baseline.security)
		expect(spec.components?.securitySchemes).toEqual(baseline.securitySchemes)
		expect(spec.paths?.['/project/listCategories']).toBeUndefined()
		expect(spec.paths?.['/admin/project/listCategories']).toBeUndefined()
	})
	it('applies detailed input and compact output only to explicitly mapped procedures with explicit scalar styles', () => {
		const procedures = [
			contracts.health,
			...Object.values(contracts.altstack),
			...Object.values(contracts.category),
			...Object.values(contracts.project),
			...Object.values(contracts.admin.category),
			...Object.values(contracts.admin.project),
			...Object.values(contracts.admin.upload.logo),
			...Object.values(contracts.admin.upload.screenshot),
		]
		const mapped = procedures
			.map((procedure) => getOpenAPIMeta(procedure))
			.filter((meta) => meta?.path !== undefined)
		expect(mapped).toHaveLength(23)
		for (const meta of mapped) {
			expect(meta?.inputStructure).toBe('detailed')
			expect(meta?.outputStructure).toBe('compact')
			const paramsStyles = meta?.path?.includes('{id}')
				? { id: 'primitive' }
				: meta?.path?.includes('{slug}')
					? { slug: 'primitive' }
					: undefined
			expect(meta?.paramsStyles).toEqual(paramsStyles)
		}
		expect(getOpenAPIMeta(contracts.project.search)?.queryStyles).toEqual({
			q: 'primitive',
			category: 'primitive',
			sort: 'primitive',
			page: 'primitive',
			limit: 'primitive',
		})
		expect(
			getOpenAPIMeta(contracts.project.listCategories)?.path
		).toBeUndefined()
		expect(
			getOpenAPIMeta(contracts.admin.project.listCategories)?.path
		).toBeUndefined()
		expect(contracts.health['~orpc'].inputSchemas ?? []).toEqual([])
		expect(contracts.altstack.listCommits['~orpc'].inputSchemas ?? []).toEqual(
			[]
		)
	})
})
