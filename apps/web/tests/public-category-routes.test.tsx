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

import { getCategoryByPathInputSchema } from '@altstack/shared/schemas/category'
import { searchProjectsInputSchema } from '@altstack/shared/schemas/project'

import { PublicProjectCategories } from '#/features/category/components/public-category'
import { categoryHead } from '#/features/category/meta'
import { getRouter } from '#/router'
import { invalidateCatalog } from '#/utils/invalidate-catalog'
import type { orpc } from '#/utils/orpc'
import { categoryFixture } from './fixtures/categories'

const { getAuthFn, rpc } = vi.hoisted(() => {
	return {
		getAuthFn: vi.fn(),
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
			beforeLoad: () => {
				return { auth: null }
			},
			component: Outlet,
		}),
	}
})
vi.mock('#/functions/get-auth-fn', () => {
	return { getAuthFn }
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
let visibleNodes = nodes
let total = 1
const routers: Array<ReturnType<typeof getRouter>> = []

beforeEach(() => {
	vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
	getAuthFn.mockReset().mockResolvedValue(null)
	visibleNodes = nodes
	total = 1
	rpc.mockReset().mockImplementation((path, input) =>
		Promise.resolve().then(() => {
			switch (path.join('/')) {
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
							count > 0
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

describe('public category routes and hierarchy UI', () => {
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
		const headings = screen.getAllByRole('heading', { level: 2 })
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
		expect(categoryHead(ai)).toEqual({
			meta: [
				{ title: 'Open Source AI-Powered Editors | Altstack' },
				{ name: 'description', content: ai.description },
			],
			links: [
				{
					rel: 'canonical',
					href: 'https://altstack.test/categories/' + ai.path,
				},
			],
		})
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
		).toContain('Most Forks')
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
			await screen.findByRole('option', { name: 'Most Stars' }),
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
			sort: 'newest',
			page: 1,
		})
		expect(rpc).toHaveBeenCalledWith(
			['project', 'search'],
			{ query: { category: ai.slug, sort: 'newest', page: 1, q: undefined } },
			expect.anything()
		)
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
