// @vitest-environment jsdom
import { ORPCError, createORPCClient } from '@orpc/client'
import type { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import type * as StartModule from '@tanstack/react-start'
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterClient, ORPCRouterOutputs } from '@altstack/api/routers'

import type { authClient } from '@altstack/auth/client'

import { getCategoryByPathInputSchema } from '@altstack/shared/schemas/category'
import { getLicenseInputSchema } from '@altstack/shared/schemas/license'
import { searchProjectsInputSchema } from '@altstack/shared/schemas/project'
import {
	getTagInputSchema,
	listTagsInputSchema,
} from '@altstack/shared/schemas/tag'

import { PublicProjectCategories } from '#/features/category/components/public-category'
import { categoryHead } from '#/features/category/meta'
import { projectQueries } from '#/features/project/queries'
import { emptyPublicContent } from '#/features/public-content/model'
import { preparePublicContent } from '#/features/public-content/server-function'
import { cataloguePolicy } from '#/features/seo/meta'
import { getRouter } from '#/router'
import { invalidateCatalog } from '#/utils/invalidate-catalog'
import type { orpc } from '#/utils/orpc'
import { categoryFixture } from './fixtures/categories'

const { getAuthFn, rpc } = vi.hoisted(() => {
	return {
		getAuthFn: vi.fn<() => Promise<typeof authClient.$Infer.Session | null>>(),
		rpc: vi.fn<(path: Array<string>, input: unknown) => Promise<unknown>>(),
	}
})
vi.mock('#/routes/__root', async () => {
	const { createRootRouteWithContext, Outlet } =
		await import('@tanstack/react-router')
	return {
		Route: createRootRouteWithContext<{
			queryClient: QueryClient
			orpc: typeof orpc
		}>()({
			beforeLoad: async () => {
				return { auth: await getAuthFn() }
			},
			component: Outlet,
		}),
	}
})
vi.mock('#/functions/get-auth-fn', () => {
	return { getAuthFn }
})
vi.mock('#/features/public-content/server-function', () => {
	return { preparePublicContent: vi.fn() }
})
vi.mock('#/hooks/use-auth-identity', () => {
	return { useAuthIdentity: vi.fn() }
})
vi.mock('#/components/auth-dialog', () => {
	return { AuthDialog: () => null }
})
vi.mock('#/components/theme-switcher', () => {
	return { ThemeSwitcher: () => null }
})
vi.mock('#/components/block-note/view.tsx', () => {
	return {
		BlockNoteViewBlocks: () => null,
	}
})
vi.mock('@altstack/api/routers', () => {
	return { routers: {} }
})
vi.mock('@altstack/api/context', () => {
	return { createORPCContext: vi.fn() }
})
vi.mock('@tanstack/react-start/server', () => {
	return {
		getRequestHeaders: vi.fn(),
		getRequestUrl: vi.fn(),
	}
})
vi.mock('@altstack/env/web', () => {
	return {
		env: {
			VITE_APP_NAME: 'Altstack',
			VITE_APP_URL: 'https://altstack.test/base?ignored=1',
			VITE_SERVER_URL: 'http://localhost:3001',
			VITE_S3_PUBLIC_URL: 'https://storage.test',
		},
	}
})
vi.mock('@tanstack/react-start', async () => {
	const actual = await vi.importActual<typeof StartModule>(
		'@tanstack/react-start'
	)
	const client: ORPCRouterClient = createORPCClient({ call: rpc })
	return {
		...actual,
		createIsomorphicFn: () => {
			return {
				server: () => {
					return { client: () => () => client }
				},
			}
		},
	}
})
vi.mock('#/features/category/redirect-search', () => {
	return {
		categoryRedirectSearch: (location: { searchStr: string }) =>
			location.searchStr,
	}
})

const root = categoryFixture(101, {
	name: 'Developer Tools',
	slug: 'developer-tools',
	path: 'developer-tools',
	isLeaf: false,
	projectCount: 1,
})
const editors = categoryFixture(102, {
	name: 'IDEs & Code Editors',
	slug: 'ides-code-editors',
	path: root.path + '/ides-code-editors',
	parentId: root.id,
	depth: 2,
	isLeaf: false,
	projectCount: 1,
})
const ai = categoryFixture(103, {
	name: 'AI-Powered Editors',
	slug: 'ai-powered-editors',
	path: editors.path + '/ai-powered-editors',
	parentId: editors.id,
	depth: 3,
	projectCount: 1,
})
const general = categoryFixture(104, {
	name: 'General Purpose Editors',
	slug: 'general-purpose-editors',
	path: editors.path + '/general-purpose-editors',
	parentId: editors.id,
	depth: 3,
	projectCount: 1,
})
const flat = categoryFixture(105, {
	name: 'Backend',
	slug: 'backend',
	path: 'backend',
	projectCount: 1,
})
const nodes = [general, root, ai, flat, editors]
const zed: ORPCRouterOutputs['project']['getBySlug'] = {
	verified: false,
	featuredProjects: [],
	tags: [
		{
			id: '10000000-0000-4000-8000-000000000099',
			slug: 'typescript',
			name: 'TypeScript',
			description: null,
		},
	],
	id: '10000000-0000-4000-8000-000000000001',
	name: 'Zed',
	slug: 'test-zed',
	tagline: 'Synthetic code editor.',
	description: 'Original synthetic description.',
	logo: 'test-fixtures/zed.svg',
	screenshot: null,
	websiteUrl: null,
	content: null,
	status: 'published',
	repositoryUrl: 'https://github.com/test/zed',
	createdAt: new Date(),
	updatedAt: new Date(),
	github: {
		licenseKey: null,
		licenseName: null,
		licenseSpdxId: null,
		licenseSlug: null,
		licenseUrl: null,
		archived: null,
		owner: 'test',
		repo: 'zed',
		stars: 123,
		forks: 12,
		fetchedAt: new Date(),
		lastCommitAt: null,
		repositoryCreatedAt: null,
		latestReleaseTag: null,
		metadataFetchedAt: null,
	},
	categoryDetails: [ai, general],
	githubStarsHistory: {
		timezone: 'Asia/Jakarta',
		windowStartDate: '2026-09-11',
		windowEndDate: '2026-10-11',
		points: [],
		comparison: null,
	},
}
const testTags = Array.from({ length: 63 }, (_, index) => {
	return {
		id: `tag-${index}`,
		slug: `backend-${index}`,
		name: `backend-${index}`,
		description: null,
		projectCount: 1,
	}
}).concat([
	{
		id: 'typescript',
		slug: 'typescript',
		name: 'TypeScript',
		description: null,
		projectCount: 1,
	},
])
let visibleNodes = nodes
let total = 1
const routers: Array<ReturnType<typeof getRouter>> = []

beforeEach(() => {
	// jsdom has no responsive media API; this fixture uses the compact viewport.
	vi.stubGlobal('matchMedia', (media: string) => {
		return {
			matches: false,
			media,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}
	})
	vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
	getAuthFn.mockReset().mockResolvedValue(null)
	vi.mocked(preparePublicContent)
		.mockReset()
		.mockResolvedValue(emptyPublicContent())
	visibleNodes = nodes
	total = 1
	rpc.mockReset().mockImplementation((path, input) =>
		Promise.resolve().then(() => {
			switch (path.join('/')) {
				case 'bookmark/get':
					return { bookmarked: false }
				case 'bookmark/list':
					return {
						bookmarks: [],
						pagination: {
							page: 1,
							limit: 25,
							totalItems: 0,
							totalPages: 0,
							hasNextPage: false,
							hasPreviousPage: false,
						},
					}
				case 'license/list':
					return {
						licenses: [
							{
								slug: 'mit',
								name: 'MIT License',
								identifier: 'MIT',
								projectCount: total,
							},
							{
								slug: 'unknown',
								name: 'unknown',
								identifier: 'unknown',
								projectCount: 1,
							},
						],
					}
				case 'license/getBySlug': {
					const { slug } = getLicenseInputSchema.parse(input).params
					if (!['mit', 'unknown'].includes(slug)) {
						throw new ORPCError('NOT_FOUND')
					}
					return {
						license: {
							slug,
							name: slug === 'mit' ? 'MIT License' : 'unknown',
							identifier: slug === 'mit' ? 'MIT' : 'unknown',
							projectCount: total,
						},
					}
				}
				case 'tag/list': {
					const { q, letter, page, limit } =
						listTagsInputSchema.parse(input).query
					const items = testTags.filter(
						(tag) =>
							(!q || tag.name.toLowerCase().includes(q.toLowerCase())) &&
							(!letter || tag.name.toUpperCase().startsWith(letter))
					)
					return {
						tags: items.slice((page - 1) * limit, page * limit),
						pagination: {
							page,
							limit,
							totalItems: items.length,
							totalPages: Math.ceil(items.length / limit),
							hasNextPage: page * limit < items.length,
							hasPreviousPage: page > 1,
						},
					}
				}
				case 'tag/getBySlug': {
					const { slug } = getTagInputSchema.parse(input).params
					const tag = testTags.find((item) => item.slug === slug)
					if (!tag) throw new ORPCError('NOT_FOUND')
					return { tag }
				}
				case 'category/list':
					return { categories: visibleNodes }
				case 'category/getByPath': {
					const { path: categoryPath } =
						getCategoryByPathInputSchema.parse(input).query
					const active = visibleNodes.find((node) => node.path === categoryPath)
					if (!active) throw new ORPCError('NOT_FOUND')
					const ancestors = visibleNodes.filter((node) =>
						active.path.startsWith(node.path + '/')
					)
					return {
						category: active,
						ancestors,
						children: visibleNodes.filter(
							(node) => node.parentId === active.id && node.projectCount > 0
						),
					}
				}
				case 'project/search': {
					const { page, q } = searchProjectsInputSchema.parse(input).query
					const count = q === 'absent' ? 0 : total
					return {
						projects:
							count > 0 && page <= Math.ceil(count / 12)
								? [{ ...zed, categories: [ai.slug, general.slug] }]
								: [],
						pagination: {
							page,
							limit: 12,
							totalItems: count,
							totalPages: Math.ceil(count / 12),
							hasNextPage: page < Math.ceil(count / 12),
							hasPreviousPage: page > 1,
						},
					}
				}
				case 'project/listCategories':
					return {
						categories: nodes.map(({ slug, name }) => {
							return { slug, name }
						}),
					}
				case 'project/getBySlug':
					return {
						...zed,
						categoryDetails: zed.categoryDetails.map(
							(category) =>
								visibleNodes.find((node) => node.id === category.id) ?? category
						),
					}
				default:
					throw new Error('Unexpected test RPC: ' + path.join('/'))
			}
		})
	)
})
afterEach(() => {
	cleanup()
	for (const router of routers.splice(0)) {
		router.options.context.queryClient.clear()
	}
	vi.useRealTimers()
	vi.unstubAllGlobals()
})

async function routerAt(url: string, show = false) {
	const router = getRouter()
	router.options.context.queryClient.clear()
	router.options.context.queryClient.setDefaultOptions({
		queries: { retry: false, staleTime: 30_000, gcTime: 0 },
	})
	router.update({
		context: router.options.context,
		history: createMemoryHistory({ initialEntries: [url] }),
	})
	routers.push(router)
	await router.load()
	if (show) render(<RouterProvider router={router} />)
	return router
}

describe('public footer', () => {
	it('credits mrboxs, links canonical categories and opens a fresh Most Starred catalogue', async () => {
		const router = await routerAt('/?q=absent&page=2', true)
		const footer = screen.getByRole('contentinfo', { name: 'Site footer' })
		const credit = within(footer).getByRole('link', { name: /^mrboxs/ })
		expect(credit.getAttribute('href')).toBe('https://x.com/isntboxs')
		expect(credit.getAttribute('target')).toBe('_blank')
		expect(credit.getAttribute('rel')).toBe('noopener noreferrer')
		const categories = await within(footer).findByRole('navigation', {
			name: 'Browse by category',
		})
		expect(within(categories).getAllByRole('link')).toHaveLength(3)
		expect(
			within(categories)
				.getByRole('link', { name: /^AI-Powered Editors/ })
				.getAttribute('href')
		).toBe('/categories/' + ai.path)
		expect(within(categories).queryByText(root.name)).toBeNull()
		fireEvent.click(within(footer).getByRole('link', { name: 'Most Starred' }))
		await waitFor(() =>
			expect(router.state.location.search.sort).toBe('most-stars')
		)
		expect(router.state.location.search.q).toBeUndefined()
		expect(router.state.location.search.page).toBeUndefined()
		expect(router.state.location.hash).toBe('catalogue')
	})

	it('keeps project content and footer navigation usable when optional categories fail', async () => {
		const original = rpc.getMockImplementation()!
		rpc.mockImplementation((path, input) =>
			path.join('/') === 'category/list'
				? Promise.reject(new Error('Footer categories unavailable'))
				: original(path, input)
		)
		const router = await routerAt('/test-zed', true)
		await waitFor(() =>
			expect(
				router.options.context.queryClient
					.getQueryCache()
					.getAll()
					.some(
						(query) =>
							query.state.error?.message === 'Footer categories unavailable'
					)
			).toBe(true)
		)
		expect(screen.getByRole('heading', { name: 'Zed' })).toBeTruthy()
		const footer = screen.getByRole('contentinfo', { name: 'Site footer' })
		expect(within(footer).getByRole('link', { name: /^mrboxs/ })).toBeTruthy()
		expect(
			within(footer).getByRole('link', { name: 'All Projects' })
		).toBeTruthy()
		expect(
			within(footer).queryByRole('navigation', { name: 'Browse by category' })
		).toBeNull()
	})
})

describe('public category routes and hierarchy UI', () => {
	it('loads public Markdown before rendering, preserves it through dialogs and refreshes on content changes', async () => {
		let content = '[First](/linked-project)'
		const originalRpc = rpc.getMockImplementation()
		if (!originalRpc) throw new Error('Missing RPC fixture')
		rpc.mockImplementation((path, input) =>
			path.join('/') === 'project/getBySlug'
				? Promise.resolve({ ...zed, content })
				: originalRpc(path, input)
		)
		vi.mocked(preparePublicContent).mockImplementation(() =>
			Promise.resolve({
				codeBlocks: {},
				projectsBySlug: {
					'linked-project': {
						slug: 'linked-project',
						name: content.includes('Second') ? 'Updated name' : 'Original name',
						logo: null,
						tagline: 'A linked project.',
						stars: 123,
						forks: 12,
					},
				},
			})
		)
		const router = await routerAt('/test-zed', true)
		expect(screen.getByRole('link', { name: 'Original name' })).toBeTruthy()
		expect(preparePublicContent).toHaveBeenCalledTimes(1)
		await act(() =>
			router.navigate({
				to: '/$slug',
				params: { slug: 'test-zed' },
				search: { dialog: 'embed' },
			})
		)
		await screen.findByRole('dialog', { name: 'Embed the Zed badge' })
		expect(preparePublicContent).toHaveBeenCalledTimes(1)
		await act(() =>
			router.navigate({
				to: '/$slug',
				params: { slug: 'test-zed' },
				search: {},
			})
		)
		content = '[Second](/linked-project)'
		await act(() => invalidateCatalog(router.options.context.queryClient))
		await screen.findByRole('link', { name: 'Updated name' })
		expect(screen.queryByRole('link', { name: 'Original name' })).toBeNull()
		await act(() =>
			router.navigate({ to: '/$slug', params: { slug: 'other-project' } })
		)
		await waitFor(() =>
			expect(preparePublicContent).toHaveBeenCalledWith(
				expect.objectContaining({ data: { slug: 'other-project' } })
			)
		)
	})

	it('reserves /categories, groups sorted roots with immediate children, and keeps legacy root leaves clickable', async () => {
		const router = await routerAt('/categories', true)
		expect(router.state.matches.at(-1)?.routeId).toBe('/_app/categories/')
		expect(
			rpc.mock.calls.some(([path]) => path.join('/') === 'project/getBySlug')
		).toBe(false)
		expect(
			screen.getByRole('heading', {
				level: 1,
				name: 'Open Source Software Categories',
			})
		).toBeTruthy()
		const headings = within(screen.getByRole('main')).getAllByRole('heading', {
			level: 2,
		})
		expect(headings.map((heading) => heading.textContent)).toEqual([
			'Backend',
			'Developer Tools',
		])
		expect(within(headings[0]).getByRole('link').getAttribute('href')).toBe(
			'/categories/backend'
		)
		const group = screen.getByRole('region', { name: 'Developer Tools' })
		expect(
			within(group)
				.getByRole('link', { name: editors.name })
				.getAttribute('href')
		).toBe('/categories/' + editors.path)
		expect(within(group).queryByText(ai.name)).toBe(null)
	})
	it.each([root, editors, ai, general])(
		'matches $name at its hierarchy depth and searches its canonical slug',
		async (node) => {
			const router = await routerAt('/categories/' + node.path)
			expect(router.state.matches.at(-1)?.routeId).toBe('/_app/categories/$')
			expect(router.state.matches.at(-1)?.status).toBe('success')
			expect(rpc).toHaveBeenCalledWith(
				['project', 'search'],
				expect.objectContaining({
					query: expect.objectContaining({ category: node.slug }) as unknown,
				}),
				expect.anything()
			)
		}
	)
	it('links breadcrumb ancestors to canonical paths and See also to direct children only', async () => {
		await routerAt('/categories/' + editors.path, true)
		const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' })
		expect(
			within(breadcrumb)
				.getByRole('link', { name: 'Home' })
				.getAttribute('href')
		).toBe('/')
		expect(
			within(breadcrumb)
				.getByRole('link', { name: 'Categories' })
				.getAttribute('href')
		).toBe('/categories')
		expect(
			within(breadcrumb)
				.getByRole('link', { name: root.name })
				.getAttribute('href')
		).toBe('/categories/' + root.path)
		const seeAlso = screen.getByRole('navigation', { name: 'See also' })
		expect(
			within(seeAlso)
				.getAllByRole('link')
				.map((link) => link.getAttribute('href'))
		).toEqual(['/categories/' + general.path, '/categories/' + ai.path])
		expect(screen.queryByRole('button', { name: 'Filter' })).toBe(null)
		expect(screen.getAllByRole('heading', { name: 'Zed' })).toHaveLength(1)
	})
	it('leaf breadcrumbs include both ancestors and leaves have no See also', async () => {
		await routerAt('/categories/' + ai.path, true)
		const breadcrumb = screen.getByRole('navigation', { name: 'breadcrumb' })
		expect(
			within(breadcrumb)
				.getByRole('link', { name: editors.name })
				.getAttribute('href')
		).toBe('/categories/' + editors.path)
		expect(screen.queryByRole('navigation', { name: 'See also' })).toBe(null)
	})
	it('renders two direct project badge links and hides the section for unassigned projects', async () => {
		await routerAt('/test-zed', true)
		const section = screen.getByRole('region', { name: 'Categories' })
		expect(
			within(section)
				.getAllByRole('link')
				.map((link) => [link.textContent, link.getAttribute('href')])
		).toEqual([
			[ai.name, '/categories/' + ai.path],
			[general.name, '/categories/' + general.path],
		])
		cleanup()
		const { container } = render(<PublicProjectCategories categories={[]} />)
		expect(container.childElementCount).toBe(0)
	})
	it('renders public project NOT_FOUND without exposing a draft', async () => {
		rpc.mockRejectedValueOnce(new ORPCError('NOT_FOUND'))
		const router = await routerAt('/test-draft', true)
		expect(router.state.matches.at(-1)?.status).toBe('notFound')
		expect(
			screen.getByRole('heading', { name: 'Project not found' })
		).toBeTruthy()
		expect(screen.queryByRole('region', { name: 'Categories' })).toBe(null)
	})
	it('keeps Categories active on descendants and opens the mobile navigation with a keyboard', async () => {
		await routerAt('/categories/' + ai.path, true)
		const navLink = screen.getAllByRole('link', { name: 'Categories' })[0]
		expect(navLink.getAttribute('data-status')).toBe('active')
		fireEvent.keyDown(screen.getByRole('button', { name: 'Open navigation' }), {
			key: 'ArrowDown',
		})
		const menuLink = await screen.findByRole('menuitem', { name: 'Categories' })
		expect(menuLink.tagName).toBe('A')
		expect(menuLink.getAttribute('href')).toBe('/categories')
		expect(menuLink.getAttribute('data-status')).toBe('active')
		fireEvent.keyDown(menuLink, { key: 'Escape' })
		await waitFor(() => expect(screen.queryByRole('menu')).toBe(null))
	})
	it('renders a useful empty index, empty category and no matching filter states', async () => {
		visibleNodes = []
		await routerAt('/categories', true)
		expect(screen.getByText('No categories to explore yet')).toBeTruthy()
		cleanup()
		visibleNodes = [{ ...flat, projectCount: 0 }]
		total = 0
		const router = await routerAt('/categories/backend', true)
		expect(router.state.matches.at(-1)?.status).toBe('success')
		expect(
			screen.getByText('There are no published projects in this category yet.')
		).toBeTruthy()
		cleanup()
		visibleNodes = nodes
		total = 1
		await routerAt('/categories/' + ai.path + '?q=absent', true)
		expect(
			screen.getByText(/No projects match your current filters/)
		).toBeTruthy()
	})
	it.each([
		'unknown',
		'backend/ides-code-editors',
		'developer-tools/ai-powered-editors',
		'developer-tools//ides-code-editors',
		'a/b/c/d',
		'bad%20path',
	])('returns not-found for %s', async (path) => {
		const router = await routerAt('/categories/' + path, true)
		expect(
			router.state.matches.some((match) => match.status === 'notFound')
		).toBe(true)
		expect(
			screen.getByRole('heading', { name: 'Category not found' })
		).toBeTruthy()
	})
	it('distinguishes transport errors from NOT_FOUND and supports retry', async () => {
		rpc.mockRejectedValueOnce(new Error('Transport unavailable'))
		const router = await routerAt('/categories/' + ai.path, true)
		expect(router.state.matches.at(-1)?.status).toBe('error')
		expect(
			screen.getByRole('heading', { name: 'Unable to load categories' })
		).toBeTruthy()
		expect(screen.queryByText('Category not found')).toBe(null)
		fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
		await screen.findByRole('heading', { name: 'Open Source ' + ai.name })
	})
	it('uses clean absolute canonical URLs and descriptions, including the null fallback', () => {
		const head = categoryHead(ai)
		expect(head.meta).toContainEqual({
			title: 'Open Source AI-Powered Editors | Altstack',
		})
		expect(head.meta).toContainEqual({
			name: 'description',
			content: ai.description,
		})
		expect(head.links).toEqual([
			{ rel: 'canonical', href: 'https://altstack.test/categories/' + ai.path },
		])

		expect(
			categoryHead({ ...ai, description: null }).meta[1]?.content
		).toContain('AI-Powered Editors')
		expect(categoryHead().links[0]?.href).toBe(
			'https://altstack.test/categories'
		)
	})
	it('invalidates category metadata, counts and listings after admin catalog changes', async () => {
		const router = await routerAt('/categories/' + ai.path)
		const previous = rpc.mock.calls.length
		visibleNodes = nodes.map((node) =>
			node.id === ai.id
				? {
						...node,
						name: 'Updated Editors',
						description: 'Updated description.',
						projectCount: 2,
					}
				: node
		)
		total = 2
		await invalidateCatalog(router.options.context.queryClient)
		await router.invalidate({ sync: true })
		expect(rpc.mock.calls.length).toBeGreaterThan(previous)
		expect(router.state.matches.at(-1)?.loaderData).toMatchObject({
			category: {
				name: 'Updated Editors',
				description: 'Updated description.',
				projectCount: 2,
			},
			projects: { pagination: { totalItems: 2 } },
		})
	})
	it('refreshes direct badge names and canonical paths after admin rename or reparent invalidation', async () => {
		const router = await routerAt('/test-zed', true)
		expect(
			within(screen.getByRole('region', { name: 'Categories' }))
				.getByRole('link', { name: ai.name })
				.getAttribute('href')
		).toBe('/categories/' + ai.path)
		const updatedPath = 'workbench/editors/updated-ai-editors'
		visibleNodes = nodes.map((node) =>
			node.id === ai.id
				? {
						...node,
						name: 'Updated AI Editors',
						slug: 'updated-ai-editors',
						path: updatedPath,
					}
				: node
		)
		await act(async () => {
			await invalidateCatalog(router.options.context.queryClient)
			await router.invalidate({ sync: true })
		})
		const badges = within(screen.getByRole('region', { name: 'Categories' }))
		const updatedBadge = await badges.findByRole('link', {
			name: 'Updated AI Editors',
		})
		expect(updatedBadge.getAttribute('href')).toBe('/categories/' + updatedPath)
		expect(badges.getAllByRole('link')).toHaveLength(2)
		expect(badges.queryByRole('link', { name: ai.name })).toBe(null)
	})
})

describe('public category search, sorting and pagination', () => {
	it.each(['/categories/' + ai.path, '/tags/typescript', '/licenses/mit'])(
		'uses most stars as the default order for canonical pagination at %s',
		(path) => {
			expect(
				cataloguePolicy(path, {
					sort: 'most-stars',
					page: 2,
				})
			).toMatchObject({
				path: path + '?page=2',
				noindex: false,
			})
			expect(cataloguePolicy(path, { sort: 'newest' })).toMatchObject({
				noindex: true,
			})
		}
	)
	it.each([
		{ path: '/categories/' + ai.path, filter: { category: ai.slug } },
		{ path: '/tags/typescript', filter: { tag: 'typescript' } },
		{ path: '/licenses/mit', filter: { license: 'mit' } },
	])(
		'defaults $path to most stars with a separate checked Order by option',
		async ({ path, filter }) => {
			const router = await routerAt(path, true)
			const sort = screen.getByRole('combobox', { name: 'Order by' })
			expect(sort.textContent).toContain('Order by')
			expect(rpc).toHaveBeenCalledWith(
				['project', 'search'],
				{
					query: {
						...filter,
						sort: 'most-stars',
						page: undefined,
						q: undefined,
					},
				},
				expect.anything()
			)
			expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull()
			fireEvent.click(sort)
			expect(
				await screen.findByRole('option', { name: 'Order by', selected: true })
			).toBeTruthy()
			expect(
				screen.queryByRole('option', { name: 'Verified first' })
			).toBeNull()
			expect(screen.getAllByRole('option')).toHaveLength(11)
			fireEvent.keyDown(screen.getByRole('option', { name: 'Most stars' }), {
				key: 'Enter',
			})
			await waitFor(() =>
				expect(router.state.location.search.sort).toBe('most-stars')
			)
			expect(sort.textContent).toContain('Most stars')
			fireEvent.click(sort)
			fireEvent.keyDown(
				await screen.findByRole('option', { name: 'Order by' }),
				{
					key: 'Enter',
				}
			)
			await waitFor(() =>
				expect(router.state.location.search.sort).toBeUndefined()
			)
			expect(sort.textContent).toContain('Order by')
			fireEvent.click(sort)
			fireEvent.keyDown(await screen.findByRole('option', { name: 'Oldest' }), {
				key: 'Enter',
			})
			await waitFor(() =>
				expect(router.state.location.search.sort).toBe('oldest')
			)
			fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
			await waitFor(() => expect(router.state.location.search).toEqual({}))
			expect(sort.textContent).toContain('Order by')
			expect(router.state.location.pathname).toBe(path)
		}
	)
	it('restores filters and listing dependencies from a reloaded category URL', async () => {
		const url = '/categories/' + ai.path + '?q=Zed&sort=most-forks&page=2'
		await routerAt(url, true)
		cleanup()
		const router = await routerAt(url, true)
		expect(
			screen.getByRole('textbox', { name: 'Search ' + ai.name + '...' })
		).toHaveProperty('value', 'Zed')
		expect(router.state.matches.at(-1)?.loaderDeps).toEqual({
			q: 'Zed',
			sort: 'most-forks',
			page: 2,
		})
		expect(
			screen.getByRole('combobox', { name: 'Order by' }).textContent
		).toContain('Most forks')
	})
	it('debounces search, resets page, keeps category and reconciles back/forward input state', async () => {
		const router = await routerAt(
			'/categories/' + ai.path + '?q=first&sort=name&page=3',
			true
		)
		const input = screen.getByRole('textbox', {
			name: 'Search ' + ai.name + '...',
		})
		fireEvent.change(input, { target: { value: ' Zed ' } })
		expect(router.state.location.search.q).toBe('first')
		await waitFor(() => expect(router.state.location.search.q).toBe('Zed'))
		expect(router.state.location.search.page).toBe(undefined)
		expect(router.state.location.search.sort).toBe('name')
		expect(router.state.location.pathname).toBe('/categories/' + ai.path)
		await act(() =>
			router.navigate({
				to: '/categories/$',
				params: { _splat: ai.path },
				search: { q: 'second' },
			})
		)
		expect(input).toHaveProperty('value', 'second')
		await act(async () => {
			router.history.back()
			await router.load()
		})
		expect(input).toHaveProperty('value', 'Zed')
		await act(async () => {
			router.history.forward()
			await router.load()
		})
		expect(input).toHaveProperty('value', 'second')
		fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
		await waitFor(() => expect(router.state.location.search).toEqual({}))
		expect(router.state.location.pathname).toBe('/categories/' + ai.path)
		expect(input).toHaveProperty('value', '')
		expect(
			screen.getByRole('combobox', { name: 'Order by' }).textContent
		).toContain('Order by')
	})
	it('sort changes reset page and category pagination hrefs retain q and sort', async () => {
		total = 36
		const router = await routerAt(
			'/categories/' + ai.path + '?q=Zed&sort=name&page=2',
			true
		)
		const next = screen.getByRole('link', { name: 'Go to next page' })
		const url = new URL(next.getAttribute('href')!, 'https://altstack.test')
		expect(url.pathname).toBe('/categories/' + ai.path)
		expect(Object.fromEntries(url.searchParams)).toEqual({
			q: 'Zed',
			sort: 'name',
			page: '3',
		})
		fireEvent.click(next)
		await waitFor(() => expect(router.state.location.search.page).toBe(3))
		expect(router.state.location.pathname).toBe('/categories/' + ai.path)
		fireEvent.click(screen.getByRole('combobox', { name: 'Order by' }))
		fireEvent.keyDown(
			await screen.findByRole('option', { name: 'Most stars' }),
			{ key: 'Enter' }
		)
		await waitFor(() =>
			expect(router.state.location.search.sort).toBe('most-stars')
		)
		expect(router.state.location.search.page).toBe(undefined)
		expect(router.state.location.search.q).toBe('Zed')
	})
	it('validates invalid filters against the existing sort whitelist and page bounds', async () => {
		const router = await routerAt(
			'/categories/' + ai.path + '?sort=arbitrary&page=-2&q=42'
		)
		expect(router.state.matches.at(-1)?.search).toMatchObject({
			sort: undefined,
			page: 1,
		})
		expect(rpc).toHaveBeenCalledWith(
			['project', 'search'],
			{
				query: { category: ai.slug, sort: 'most-stars', page: 1, q: undefined },
			},
			expect.anything()
		)
	})
	it('selects Order by for the recommended homepage sort and restores it after changing sorts', async () => {
		const router = await routerAt('/', true)
		const sort = screen.getByRole('combobox', { name: 'Order by' })
		expect(sort.textContent).toContain('Order by')
		expect(
			rpc.mock.calls.some(
				([path, input]) =>
					path.join('/') === 'project/search' &&
					searchProjectsInputSchema.parse(input).query.sort === 'recommended'
			)
		).toBe(true)
		fireEvent.click(sort)
		expect(
			await screen.findByRole('option', { name: 'Order by', selected: true })
		).toBeTruthy()
		expect(screen.queryByRole('option', { name: 'Verified first' })).toBeNull()
		const mostStars = screen.getByRole('option', { name: 'Most stars' })
		fireEvent.pointerDown(mostStars, { pointerType: 'mouse' })
		fireEvent.click(mostStars)
		await waitFor(() =>
			expect(router.state.location.search.sort).toBe('most-stars')
		)
		expect(sort.textContent).toContain('Most stars')
		fireEvent.click(sort)
		const recommended = await screen.findByRole('option', { name: 'Order by' })
		fireEvent.pointerDown(recommended, { pointerType: 'mouse' })
		fireEvent.click(recommended)
		await waitFor(() =>
			expect(router.state.location.search.sort).toBeUndefined()
		)
		expect(sort.textContent).toContain('Order by')
		expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull()
	})
	it('retains homepage category/search/reset and home pagination URLs', async () => {
		total = 36
		const router = await routerAt(
			'/?category=backend&q=Zed&sort=name&page=2',
			true
		)
		fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
		expect(
			await screen.findByRole('combobox', { name: 'Category' })
		).toBeTruthy()
		const next = new URL(
			screen
				.getByRole('link', { name: 'Go to next page' })
				.getAttribute('href')!,
			'https://altstack.test'
		)
		expect(next.pathname).toBe('/')
		expect(Object.fromEntries(next.searchParams)).toEqual({
			category: 'backend',
			q: 'Zed',
			sort: 'name',
			page: '3',
		})
		fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
		await waitFor(() => expect(router.state.location.search).toEqual({}))
		expect(router.state.location.pathname).toBe('/')
		expect(
			screen.getByRole('combobox', { name: 'Order by' }).textContent
		).toContain('Order by')
	})
	it('redirects historical paths with 308 before any listing and canonical navigation has no loop', async () => {
		const original = rpc.getMockImplementation()!
		rpc.mockImplementation((path, input) =>
			path.join('/') === 'category/getByPath' &&
			getCategoryByPathInputSchema.parse(input).query.path ===
				'old-root/old-parent/old-leaf'
				? Promise.resolve({
						category: ai,
						ancestors: [root, editors],
						children: [],
					})
				: original(path, input)
		)
		const query =
			'?q=Zed&sort=name&page=2&campaign=hello%20world&returnTo=https%3A%2F%2Fevil.test'
		const historicalRouter = getRouter()
		historicalRouter.options.context.queryClient.clear()
		historicalRouter.update({
			context: historicalRouter.options.context,
			history: createMemoryHistory({
				initialEntries: ['/categories/old-root/old-parent/old-leaf' + query],
			}),
		})
		routers.push(historicalRouter)
		// jsdom cannot navigate documents. Assert the actual router handoff;
		// the HTTP acceptance and collaborative browser follow it for real.
		const navigate = vi
			.spyOn(historicalRouter, 'navigate')
			.mockResolvedValue(undefined)
		await historicalRouter.load()
		expect(navigate).toHaveBeenCalledWith(
			expect.objectContaining({
				href:
					'/categories/' + ai.path + historicalRouter.latestLocation.searchStr,
				statusCode: 308,
				replace: true,
				reloadDocument: true,
			})
		)
		expect(
			rpc.mock.calls.filter(([path]) => path.join('/') === 'project/search')
		).toHaveLength(0)
		navigate.mockRestore()
		const router = await routerAt('/categories/' + ai.path + query)
		expect(router.state.location.pathname).toBe('/categories/' + ai.path)
		expect(router.state.location.search).toMatchObject({
			q: 'Zed',
			sort: 'name',
			page: 2,
			campaign: 'hello world',
			returnTo: 'https://evil.test',
		})
		const detailCalls = rpc.mock.calls.filter(
			([path]) => path.join('/') === 'category/getByPath'
		)
		expect(
			detailCalls.map(
				([, input]) => getCategoryByPathInputSchema.parse(input).query.path
			)
		).toEqual(['old-root/old-parent/old-leaf', ai.path])
		expect(
			rpc.mock.calls.filter(([path]) => path.join('/') === 'project/search')
		).toHaveLength(1)
	})
})

describe('L2 public affordances and recovery', () => {
	it('distinguishes an empty unfiltered catalogue from transport failures and offers browsing recovery', async () => {
		total = 0
		await routerAt('/', true)
		expect(
			screen.getByText(
				'There are no published projects available in the catalogue yet.'
			)
		).toBeTruthy()
		expect(
			screen
				.getByRole('link', { name: 'Browse categories' })
				.getAttribute('href')
		).toBe('/categories')
		expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
	})
	it('uses a real hero anchor and keeps Introducing outside the tab order', async () => {
		await routerAt('/', true)
		const anchor = screen.getByRole('link', { name: 'Explore Projects' })
		expect(anchor.getAttribute('href')).toBe('#catalogue')
		expect(screen.queryByRole('button', { name: /Introducing/ })).toBeNull()
		fireEvent.click(anchor)
		expect(document.activeElement?.id).toBe('catalogue')
		expect(screen.queryByText(/compare alternatives|trending/)).toBeNull()
	})
	it('enables Verify alongside Bookmark, Report and Embed', async () => {
		await routerAt('/test-zed', true)
		expect(screen.getByRole('button', { name: 'Verify' })).toHaveProperty(
			'disabled',
			false
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'More project actions' })
		)
		expect(await screen.findByRole('menuitem', { name: 'Verify' })).toBeTruthy()
		expect(screen.getByRole('menuitem', { name: 'Report' })).toBeTruthy()
		expect(screen.getByRole('menuitem', { name: 'Embed' })).toBeTruthy()
	})

	it('opens/closes Embed through URL history without reloading stale project data and preserves other search state', async () => {
		const router = await routerAt('/test-zed?ref=docs&dialog=unknown', true)
		expect(screen.queryByRole('dialog')).toBeNull()
		const before = rpc.mock.calls.filter(
			([path]) => path.join('/') === 'project/getBySlug'
		).length
		// Make the query stale: dialog transitions must not invoke the loader.
		router.options.context.queryClient.setQueryData(
			projectQueries.bySlug('test-zed').queryKey,
			zed,
			{ updatedAt: 1 }
		)
		fireEvent.click(screen.getByRole('button', { name: 'Embed' }))
		await screen.findByRole('dialog', { name: 'Embed the Zed badge' })
		expect(router.state.location.search).toMatchObject({
			ref: 'docs',
			dialog: 'embed',
		})
		fireEvent.change(screen.getByLabelText('Width'), {
			target: { value: '320' },
		})
		act(() => router.history.back())
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		act(() => router.history.forward())
		await screen.findByRole('dialog')
		expect(screen.getByLabelText('Width')).toHaveProperty('value', '320')
		fireEvent.click(screen.getByRole('button', { name: 'Close' }))
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		expect(router.state.location.search).toMatchObject({ ref: 'docs' })
		expect(router.state.location.search.dialog).toBeUndefined()
		act(() => router.history.back())
		await screen.findByRole('dialog')
		expect(
			rpc.mock.calls.filter(([path]) => path.join('/') === 'project/getBySlug')
		).toHaveLength(before)
	})
	it('opens the dialog from a direct URL and removes its state on close', async () => {
		const router = await routerAt('/test-zed?dialog=embed', true)
		await screen.findByRole('dialog', { name: 'Embed the Zed badge' })
		fireEvent.click(screen.getByRole('button', { name: 'Close' }))
		await waitFor(() =>
			expect(router.state.location.search.dialog).toBeUndefined()
		)
		await waitFor(() =>
			expect(document.activeElement).toBe(
				screen.getByRole('button', { name: 'More project actions' })
			)
		)
	})
	it.each(['unknown', 'bookmark'])(
		'ignores unknown dialog=%s without phantom flows',
		async (dialog) => {
			await routerAt(`/test-zed?dialog=${dialog}`, true)
			expect(screen.queryByRole('dialog')).toBeNull()
		}
	)
	it('hands compact Embed to the dialog and returns focus to More', async () => {
		await routerAt('/test-zed', true)
		const trigger = screen.getByRole('button', { name: 'More project actions' })
		fireEvent.keyDown(trigger, { key: 'ArrowDown' })
		fireEvent.click(await screen.findByRole('menuitem', { name: 'Embed' }))
		await screen.findByRole('dialog')
		fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		await waitFor(() => expect(document.activeElement).toBe(trigger))
	})
	it.each(['user', 'admin'] as const)(
		'enables %s account Bookmarks and preserves its workspace destination',
		async (role) => {
			const now = new Date()
			getAuthFn.mockResolvedValue({
				session: {
					id: 'fixture-session',
					token: 'local-only',
					userId: 'fixture-user',
					expiresAt: new Date(now.getTime() + 60000),
					createdAt: now,
					updatedAt: now,
					ipAddress: null,
					userAgent: null,
				},
				user: {
					id: 'fixture-user',
					name: 'Fixture User',
					email: 'fixture@example.test',
					emailVerified: true,
					image: null,
					role,
					createdAt: now,
					updatedAt: now,
				},
			})
			const router = await routerAt('/test-zed', true)
			fireEvent.keyDown(
				screen.getByRole('button', { name: 'Open user menu' }),
				{ key: 'ArrowDown' }
			)
			const destination = await screen.findByRole('menuitem', {
				name: role === 'admin' ? 'Admin overview' : 'Submission',
			})
			expect(destination.getAttribute('href')).toBe(
				role === 'admin' ? '/admin' : '/submission'
			)
			const bookmarks = screen.getByRole('menuitem', {
				name: 'Bookmarks',
			})
			expect(bookmarks.getAttribute('aria-disabled')).not.toBe('true')
			expect(bookmarks.getAttribute('href')).toBe('/bookmarks')
			fireEvent.click(bookmarks)
			await waitFor(() =>
				expect(router.state.location.pathname).toBe('/bookmarks')
			)
			await screen.findByText('No bookmarks yet')
			expect(screen.queryByRole('dialog')).toBeNull()
		}
	)
	it.each([
		['/', '/categories'],
		['/', '/test-zed'],
		['/', '/submit'],
		['/categories/' + ai.path, '/test-zed'],
	])(
		'keeps catalogue results visible when navigating from %s to %s',
		async (from, destination) => {
			const router = await routerAt(from, true)
			let release: () => void = () => undefined
			const gate = new Promise<null>((resolve) => {
				release = () => resolve(null)
			})
			getAuthFn.mockImplementationOnce(() => gate)
			let navigation: Promise<void> = Promise.resolve()
			act(() => {
				navigation = router.navigate({ href: destination })
			})
			await waitFor(() => expect(router.state.isLoading).toBe(true))
			try {
				expect(screen.getByRole('heading', { name: 'Zed' })).toBeTruthy()
				expect(screen.queryByText('Loading projects…')).toBeNull()
				expect(
					screen
						.getByRole('region', { name: 'Project results' })
						.closest('[aria-busy="true"]')
				).toBeNull()
			} finally {
				await act(async () => {
					release()
					await navigation
				})
			}
			expect(router.state.location.pathname).toBe(
				destination === '/submit' ? '/auth/sign-in' : destination
			)
			expect(router.state.location.search.returnTo).toBe(
				destination === '/submit' ? '/submit' : undefined
			)
		}
	)
	it('uses cached catalogue results without flashing a loading skeleton', async () => {
		const router = await routerAt('/', true)
		await router.preloadRoute({ to: '/', search: { q: 'Zed' } })
		let showedPending = false
		const observer = new MutationObserver(() => {
			showedPending ||= document.body.textContent.includes('Loading projects…')
		})
		observer.observe(document.body, { childList: true, subtree: true })
		try {
			await act(() => router.navigate({ to: '/', search: { q: 'Zed' } }))
			expect(screen.getByRole('heading', { name: 'Zed' })).toBeTruthy()
			expect(screen.getByRole('textbox')).toHaveProperty('value', 'Zed')
			expect(showedPending).toBe(false)
		} finally {
			observer.disconnect()
		}
	})
	it.each(['/', '/categories/' + ai.path])(
		'preserves focused search while delayed results replace older cards at %s',
		async (url) => {
			await routerAt(url, true)
			const original = rpc.getMockImplementation()!
			let release: () => void = () => undefined
			const gate = new Promise<void>((resolve) => {
				release = resolve
			})
			rpc.mockImplementation(async (path, input) => {
				if (
					path.join('/') === 'project/search' &&
					searchProjectsInputSchema.parse(input).query.q === 'absent'
				) {
					await gate
				}
				return original(path, input)
			})
			const input = screen.getByRole('textbox')
			input.focus()
			fireEvent.change(input, { target: { value: 'absent' } })
			expect(screen.getByText('Search update pending…')).toBeTruthy()
			await screen.findByText(/Loading (projects|categories)…/)
			await new Promise((resolve) => setTimeout(resolve, 400))
			expect(document.activeElement).toBe(input)
			expect(screen.queryByRole('heading', { name: 'Zed' })).toBeNull()
			fireEvent.change(input, { target: { value: 'absent ' } })
			act(() => {
				release()
			})
			await screen.findByText(/No projects match your current filters/)
			expect(document.activeElement).toBe(input)
			expect(input).toHaveProperty('value', 'absent ')
		}
	)
	it.each(['/', '/test-zed', '/categories/' + ai.path])(
		'really refetches after an outage and keeps failures separate from empty/404 at %s',
		async (url) => {
			rpc.mockRejectedValueOnce(new Error('PRIVATE_transport_detail'))
			await routerAt(url, true)
			expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
			expect(
				screen.queryByText(
					/No projects found|Project not found|PRIVATE_transport_detail/
				)
			).toBeNull()
			const before = rpc.mock.calls.length
			fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
			await screen.findByRole('heading', {
				name: url.includes('categories') ? 'Open Source ' + ai.name : 'Zed',
			})
			expect(rpc.mock.calls.length).toBeGreaterThan(before)
		}
	)
	it('distinguishes an out-of-range filtered page and recovers without dropping filters', async () => {
		total = 36
		const router = await routerAt(
			'/?category=backend&q=Zed&sort=name&page=99',
			true
		)
		expect(
			screen.getByRole('heading', { name: 'No projects on this page' })
		).toBeTruthy()
		const first = screen.getByRole('link', { name: 'First page' })
		expect(first.getAttribute('href')).toContain('category=backend')
		fireEvent.click(first)
		await waitFor(() =>
			expect(router.state.location.search.page).toBeUndefined()
		)
		expect(router.state.location.search).toMatchObject({
			category: 'backend',
			q: 'Zed',
			sort: 'name',
		})
		const previous = screen.getByRole('button', { name: 'Go to previous page' })
		expect(previous).toHaveProperty('disabled', true)
		expect(previous.getAttribute('href')).toBeNull()
	})
	it('renders an accessible card title link with visible metadata and decorative logo semantics', async () => {
		await routerAt('/', true)
		const card = screen
			.getByRole('heading', { name: 'Zed' })
			.closest('article')!
		expect(
			within(card).getByRole('link', { name: 'Zed' }).getAttribute('href')
		).toBe('/test-zed')
		expect(card.querySelector('a a, button')).toBeNull()
		expect(within(card).getByRole('link', { name: 'Zed' })).toBeTruthy()
		expect(
			['Stars', 'Last commit', 'License'].map(
				(label) => within(card).getByText(label).textContent
			)
		).toEqual(['Stars', 'Last commit', 'License'])
		expect(within(card).queryByText('Forks')).toBeNull()
		expect(within(card).queryByRole('img')).toBeNull()
	})
})

describe('public destinations and cache retry', () => {
	it.each([null, 'javascript:alert(1)', 'https://project.test/path'])(
		'only exposes an accepted website destination: %s',
		async (websiteUrl) => {
			const original = rpc.getMockImplementation()!
			rpc.mockImplementation((path, input) =>
				path.join('/') === 'project/getBySlug'
					? Promise.resolve({
							...zed,
							websiteUrl,
							screenshot: 'stored/screenshot.png',
						})
					: original(path, input)
			)
			await routerAt('/test-zed', true)
			const website = screen.queryByRole('link', {
				name: 'Visit Website (opens in a new tab)',
			})
			expect(website?.getAttribute('href') ?? null).toBe(
				websiteUrl?.startsWith('https:') ? websiteUrl : null
			)
			expect(
				screen.getByRole('img', { name: 'Screenshot of Zed' })
			).toBeTruthy()
			expect(
				screen
					.getByRole('link', { name: /^Visit GitHub.*opens in a new tab/ })
					.getAttribute('rel')
			).toBe('noopener noreferrer')
		}
	)
	it('invalidates freshly cached external data before retrying the failed route', async () => {
		rpc.mockRejectedValueOnce(new Error('Outage'))
		const router = await routerAt('/test-zed', true)
		// A different observer may have populated a fresh cache while the route
		// boundary is still showing its earlier failure. Retry must refetch it.
		router.options.context.queryClient.setQueryData(
			projectQueries.bySlug('test-zed').queryKey,
			{ ...zed, name: 'OLD_CACHE_SENTINEL' }
		)
		const before = rpc.mock.calls.length
		fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
		await screen.findByRole('heading', { name: 'Zed' })
		expect(
			screen.queryByRole('heading', { name: 'OLD_CACHE_SENTINEL' })
		).toBeNull()
		expect(rpc.mock.calls.length).toBeGreaterThan(before)
	})
})

it('keeps a cold category request alive while its pending controls render', async () => {
	const router = await routerAt('/', true)
	const original = rpc.getMockImplementation()!
	let release: () => void = () => undefined
	const gate = new Promise<void>((resolve) => {
		release = resolve
	})
	rpc.mockImplementation(async (path, input) => {
		if (path.join('/') === 'category/getByPath') await gate
		return original(path, input)
	})
	let navigation = Promise.resolve()
	act(() => {
		navigation = router.navigate({
			to: '/categories/$',
			params: { _splat: ai.path },
		})
	})
	try {
		await screen.findByText('Loading projects…')
		expect(
			document.querySelector('[data-skeleton="category-controls"]')
		).not.toBeNull()
		expect(screen.queryByText('Unable to load categories')).toBeNull()
	} finally {
		await act(async () => {
			release()
			await navigation
		})
	}
	await screen.findByRole('heading', { name: `Open Source ${ai.name}` })
	expect(screen.queryByText('Unable to load categories')).toBeNull()
})

describe('public tags', () => {
	it.each([
		[
			'/tags/typescript',
			'Open Source Projects tagged "TypeScript" | AltStack',
			'/tags/typescript',
		],
		[
			'/tags/typescript?page=2',
			'Open Source Projects tagged "TypeScript" — Page 2 | AltStack',
			'/tags/typescript?page=2',
		],
	])(
		'uses distinct SEO titles and canonical URLs for %s',
		async (url, title, canonical) => {
			total = 25
			const router = await routerAt(url)
			const match = router.state.matches.at(-1)
			expect(match?.meta).toContainEqual({ title })
			expect(match?.meta).toContainEqual({
				property: 'og:title',
				content: title,
			})
			expect(match?.links).toContainEqual({
				rel: 'canonical',
				href: `https://altstack.test${canonical}`,
			})
		}
	)

	it('canonicalizes topic identity and returns not found for invalid slugs', async () => {
		const canonical = await routerAt(
			'/tags/TypeScript?q=zed&sort=most-stars&page=2'
		)
		expect(canonical.state.location.pathname).toBe('/tags/typescript')
		expect(canonical.state.location.search).toMatchObject({
			q: 'zed',
			sort: 'most-stars',
			page: 2,
		})
		await routerAt('/tags/not_a_topic', true)
		await screen.findByRole('heading', { name: 'Tag not found' })
	})

	it('links project tags below categories to a scoped project catalogue', async () => {
		const router = await routerAt('/test-zed', true)
		const section = screen.getByRole('region', { name: 'Tags' })
		const tagLink = within(section).getByRole('link', { name: /TypeScript/ })
		expect(tagLink.getAttribute('href')).toBe('/tags/typescript')
		fireEvent.click(tagLink)
		await screen.findByRole('heading', {
			name: 'Open Source Projects tagged "TypeScript"',
		})
		await waitFor(() =>
			expect(router.state.location.pathname).toBe('/tags/typescript')
		)
		expect(rpc).toHaveBeenCalledWith(
			['project', 'search'],
			{
				query: {
					tag: 'typescript',
					q: undefined,
					sort: 'most-stars',
					page: undefined,
				},
			},
			expect.anything()
		)
	})

	it('keeps letter, search, and sort in pagination URLs and resets page when the letter changes', async () => {
		const router = await routerAt('/tags?letter=B&sort=name-desc&page=2', true)
		await screen.findByRole('heading', { name: 'Browse Open Source Tags' })
		const letter = screen.getByRole('link', { name: 'Tags starting with B' })
		expect(letter.getAttribute('aria-current')).toBe('page')
		const pagination = screen.getByRole('navigation', {
			name: 'Tags pagination',
		})
		expect(
			within(pagination).getAllByRole('link', { current: 'page' })
		).toHaveLength(1)
		expect(
			within(pagination).getByRole('link', { current: 'page' }).textContent
		).toBe('2')
		expect(
			within(pagination)
				.getByRole('link', { name: 'Prev' })
				.getAttribute('href')
		).toContain('letter=B')
		expect(
			within(pagination)
				.getByRole('link', { name: 'Prev' })
				.getAttribute('href')
		).toContain('sort=name-desc')
		fireEvent.click(screen.getByRole('link', { name: 'Tags starting with T' }))
		await waitFor(() => expect(router.state.location.search.letter).toBe('T'))
		expect(router.state.location.search.page).toBeUndefined()
		expect(router.state.location.search.sort).toBe('name-desc')
		fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
		await waitFor(() => expect(router.state.location.search).toEqual({}))
	})

	it('debounces tag search and restores the input from browser history', async () => {
		const router = await routerAt('/tags?letter=B&page=2', true)
		const input = await screen.findByRole('textbox', { name: 'Search tags' })
		input.focus()
		fireEvent.change(input, { target: { value: 'backend' } })
		await waitFor(() => expect(router.state.location.search.q).toBe('backend'))
		expect(router.state.location.search.page).toBeUndefined()
		expect(router.state.location.search.letter).toBe('B')
		expect(document.activeElement).toBe(input)
		await act(() => router.navigate({ to: '/tags', search: { q: 'type' } }))
		await waitFor(() => expect((input as HTMLInputElement).value).toBe('type'))
		act(() => router.history.back())
		await waitFor(() =>
			expect((input as HTMLInputElement).value).toBe('backend')
		)
	})

	it('renders missing tags as not found and validates malformed directory filters', async () => {
		await routerAt('/tags/missing', true)
		await screen.findByRole('heading', { name: 'Tag not found' })
		cleanup()
		const router = await routerAt('/tags?letter=invalid&sort=invalid&page=-2')
		expect(router.state.matches.at(-1)?.search).toMatchObject({
			letter: undefined,
			sort: undefined,
			page: undefined,
		})
	})
})

describe('public license routes', () => {
	it('renders the empty directory without inventing licenses', async () => {
		const original = rpc.getMockImplementation()!
		rpc.mockImplementation((path, input) =>
			path.join('/') === 'license/list'
				? Promise.resolve({ licenses: [] })
				: original(path, input)
		)
		await routerAt('/licenses', true)
		expect(screen.getByText('No licenses to explore yet')).toBeTruthy()
		expect(screen.queryByRole('link', { name: 'MIT 1 project' })).toBeNull()
	})
	it('recovers directory fetch errors through the shared retry control', async () => {
		const original = rpc.getMockImplementation()!
		let failing = true
		rpc.mockImplementation((path, input) =>
			path.join('/') === 'license/list' && failing
				? Promise.reject(new ORPCError('INTERNAL_SERVER_ERROR'))
				: original(path, input)
		)
		await routerAt('/licenses', true)
		expect(
			screen.getByRole('heading', { name: 'Unable to load licenses' })
		).toBeTruthy()
		failing = false
		fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
		expect(
			await screen.findByRole('heading', {
				name: 'Browse Open Source Software Licenses',
			})
		).toBeTruthy()
	})

	it('keeps card metadata order, independent discovery links, archival, and detail license document access', async () => {
		const original = rpc.getMockImplementation()!
		const detected = {
			licenseKey: 'mit',
			licenseName: 'MIT License',
			licenseSpdxId: 'MIT',
			licenseSlug: 'mit',
			licenseUrl: 'https://spdx.org/licenses/MIT.html',
			archived: true,
		}
		rpc.mockImplementation(async (path, input) => {
			if (path.join('/') === 'project/search') {
				return {
					projects: [
						{ ...zed, github: { ...zed.github, ...detected }, categories: [] },
					],
					pagination: {
						page: 1,
						limit: 12,
						totalItems: 1,
						totalPages: 1,
						hasNextPage: false,
						hasPreviousPage: false,
					},
				}
			}
			if (path.join('/') === 'project/getBySlug') {
				return { ...zed, github: { ...zed.github, ...detected } }
			}
			return original(path, input)
		})
		const router = await routerAt('/', true)
		const card = screen
			.getByRole('heading', { name: 'Zed' })
			.closest('article')!
		expect(within(card).getByText('Archived')).toBeTruthy()
		expect(
			Array.from(card.querySelectorAll('span.text-muted-foreground'))
				.map((node) => node.textContent)
				.filter(Boolean)
		).toEqual(['Stars', 'Last commit', 'License'])
		expect(
			within(card).getByRole('link', { name: 'MIT' }).getAttribute('href')
		).toBe('/licenses/mit')
		expect(card.querySelector('a a')).toBeNull()
		await act(() =>
			router.navigate({ to: '/$slug', params: { slug: 'test-zed' } })
		)
		expect(screen.getByText('Archived')).toBeTruthy()
		const label = screen.getByText('License', { selector: 'span' })
		expect(
			label.parentElement?.parentElement?.nextElementSibling?.textContent
		).toContain('Repository')
		expect(screen.getByRole('link', { name: 'MIT' }).getAttribute('href')).toBe(
			'/licenses/mit'
		)
		expect(
			screen
				.getByRole('link', { name: 'Read MIT license document' })
				.getAttribute('href')
		).toBe('https://spdx.org/licenses/MIT.html')
	})

	it('renders published counts, discovery links, breadcrumbs and directory SEO', async () => {
		const router = await routerAt('/licenses', true)
		expect(
			screen.getByRole('heading', {
				name: 'Browse Open Source Software Licenses',
			})
		).toBeTruthy()
		expect(
			screen.getByRole('link', { name: 'MIT 1 project' }).getAttribute('href')
		).toBe('/licenses/mit')
		expect(screen.getByRole('link', { name: 'unknown 1 project' })).toBeTruthy()
		expect(router.state.matches.at(-1)?.links).toContainEqual({
			rel: 'canonical',
			href: 'https://altstack.test/licenses',
		})
	})
	it('keeps license-scoped filters, pagination and history in the URL', async () => {
		total = 25
		const router = await routerAt('/licenses/mit?page=2&sort=last-commit', true)
		expect(
			screen.getByRole('heading', { name: 'MIT Licensed Open Source Software' })
		).toBeTruthy()
		expect(
			screen.getByText('25 published projects licensed under MIT.')
		).toBeTruthy()
		expect(
			rpc.mock.calls.some(([path, input]) => {
				if (path.join('/') !== 'project/search') return false
				const query = searchProjectsInputSchema.parse(input).query
				return (
					query.license === 'mit' &&
					query.page === 2 &&
					query.sort === 'last-commit'
				)
			})
		).toBe(true)
		await act(() =>
			router.navigate({
				to: '/licenses/$slug',
				params: { slug: 'mit' },
				search: { q: 'absent', sort: 'name-desc' },
			})
		)
		expect(
			await screen.findByRole('heading', { name: 'No projects found' })
		).toBeTruthy()
		expect(
			screen.getByRole('textbox', { name: 'Search in "MIT"...' })
		).toHaveProperty('value', 'absent')
		await act(async () => {
			router.history.back()
			await router.load()
		})
		await waitFor(() => expect(router.state.location.search.page).toBe(2))
		expect(
			screen.getByRole('textbox', { name: 'Search in "MIT"...' })
		).toHaveProperty('value', '')
		await act(async () => {
			router.history.forward()
			await router.load()
		})
		await waitFor(() => expect(router.state.location.search.q).toBe('absent'))
		expect(
			screen.getByRole('textbox', { name: 'Search in "MIT"...' })
		).toHaveProperty('value', 'absent')
	})
	it('validates direct search state and provides out-of-range recovery', async () => {
		const router = await routerAt('/licenses/mit?sort=invalid&page=-1', true)
		expect(router.state.location.search.sort).toBeUndefined()
		expect(router.state.location.search.page).toBe(1)
		await act(() =>
			router.navigate({
				to: '/licenses/$slug',
				params: { slug: 'mit' },
				search: { page: 999 },
			})
		)
		expect(
			await screen.findByRole('heading', { name: 'No projects on this page' })
		).toBeTruthy()
		fireEvent.click(screen.getByRole('link', { name: 'First page' }))
		await waitFor(() =>
			expect(router.state.location.search.page).toBeUndefined()
		)
	})
	it('shows a factual unknown catalogue, noindex, and real missing-license 404s', async () => {
		const router = await routerAt('/licenses/unknown', true)
		expect(
			screen.getByRole('heading', { name: 'Projects with unknown License' })
		).toBeTruthy()
		expect(
			screen.getByText(
				/including custom licenses|This includes custom licenses/
			)
		).toBeTruthy()
		expect(router.state.matches.at(-1)?.meta).toContainEqual({
			name: 'robots',
			content: 'noindex, follow',
		})
		await act(() =>
			router.navigate({
				to: '/licenses/$slug',
				params: { slug: 'private-only' },
				search: {},
			})
		)
		expect(
			await screen.findByRole('heading', { name: 'License not found' })
		).toBeTruthy()
		expect(router.state.matches.at(-1)?.status).toBe('notFound')
	})
})
