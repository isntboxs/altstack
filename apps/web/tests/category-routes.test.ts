import { createMemoryHistory } from '@tanstack/react-router'
// @vitest-environment jsdom
import type * as StartModule from '@tanstack/react-start'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterClient } from '@altstack/api/routers'

import { submissionQueries } from '#/features/submissions/queries'
import { getRouter } from '#/router'
import { categories, flat } from './fixtures/categories'

const { getAuthFn, rpc } = vi.hoisted(() => {
	return {
		getAuthFn: vi.fn(),
		rpc: vi.fn(),
	}
})
vi.mock('#/functions/get-auth-fn', () => {
	return { getAuthFn }
})
vi.mock('#/hooks/use-auth-identity', () => {
	return { useAuthIdentity: vi.fn() }
})
vi.mock('@altstack/api/routers', () => {
	return { routers: {} }
})
vi.mock('@altstack/api/context', () => {
	return { createORPCContext: vi.fn() }
})
vi.mock('@tanstack/react-start/server', () => {
	return { getRequestHeaders: vi.fn() }
})
vi.mock('@altstack/env/web', () => {
	return {
		env: {
			VITE_SERVER_URL: 'http://localhost:3001',
			VITE_S3_PUBLIC_URL: 'https://storage.test',
		},
	}
})
vi.mock('@tanstack/react-start', async () => {
	const actual = await vi.importActual<typeof StartModule>(
		'@tanstack/react-start'
	)
	const { createORPCClient } = await import('@orpc/client')
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

beforeEach(() => {
	getAuthFn
		.mockReset()
		.mockResolvedValue({ user: { role: 'admin' }, session: {} })
	rpc.mockReset().mockImplementation((path: Array<string>) => {
		if (path.join('/') === 'submission/list') {
			return Promise.resolve({
				submissions: [],
				pagination: {
					page: 1,
					limit: 25,
					totalPages: 0,
					totalItems: 0,
					hasNextPage: false,
					hasPreviousPage: false,
				},
			})
		}
		if (path.join('/') === 'admin/category/getById') {
			return Promise.resolve({ category: flat, ancestors: [], children: [] })
		}
		return Promise.resolve({
			categories,
			projects: [],
			pagination: { page: 1, totalPages: 0, totalItems: 0 },
		})
	})
})
afterEach(() => vi.clearAllMocks())

function routerAt(path: string) {
	const router = getRouter()
	router.options.context.queryClient.clear()
	router.update({
		context: router.options.context,
		history: createMemoryHistory({ initialEntries: [path] }),
	})
	return router
}

describe('category routes and preloading guards', () => {
	it.each([
		'/admin/categories',
		'/admin/categories/create',
		`/admin/categories/${flat.id}/edit`,
	])(
		'redirects anonymous %s with returnTo before loading private data',
		async (path) => {
			getAuthFn.mockResolvedValue(null)
			const router = routerAt(path)
			await router.load()
			expect(router.state.location.pathname).toBe('/auth/sign-in')
			expect(router.state.location.search).toEqual({ returnTo: path })
			expect(
				rpc.mock.calls.some(
					([route]) =>
						Array.isArray(route) && route.join('/').startsWith('admin/category')
				)
			).toBe(false)
		}
	)
	it('redirects non-admin direct navigation and blocks private preloads', async () => {
		getAuthFn.mockResolvedValue({ user: { role: 'user' }, session: {} })
		const router = routerAt('/admin/categories/create')
		await router.load()
		expect(router.state.location.pathname).toBe('/')
		await router.preloadRoute({
			to: '/admin/categories/$id/edit',
			params: { id: flat.id },
		})
		expect(
			rpc.mock.calls.some(
				([route]) =>
					Array.isArray(route) && route.join('/').startsWith('admin/category')
			)
		).toBe(false)
	})
	it('loads the list and edit data for admins', async () => {
		const router = routerAt(`/admin/categories/${flat.id}/edit`)
		await router.load()
		expect(rpc).toHaveBeenCalledWith(
			['admin', 'category', 'getById'],
			{ params: { id: flat.id } },
			expect.anything()
		)
		expect(rpc).toHaveBeenCalledWith(
			['admin', 'category', 'list'],
			{},
			expect.anything()
		)
		expect(router.state.matches.at(-1)?.status).toBe('success')
	})
	it('renders a not-found route for invalid UUIDs without a detail request', async () => {
		const router = routerAt('/admin/categories/not-a-uuid/edit')
		await router.load()
		expect(
			router.state.matches.some((match) => match.status === 'notFound')
		).toBe(true)
		expect(rpc).not.toHaveBeenCalled()
	})
	it('renders a not-found route when a valid UUID has been deleted', async () => {
		const { ORPCError } = await import('@orpc/client')
		rpc.mockRejectedValue(
			new ORPCError('NOT_FOUND', { message: 'Category does not exist.' })
		)
		const router = routerAt(`/admin/categories/${flat.id}/edit`)
		await router.load()
		expect(
			router.state.matches.some((match) => match.status === 'notFound')
		).toBe(true)
	})
})

describe('submission and project review guards', () => {
	it('does not reuse private query results after switching accounts', async () => {
		const router = getRouter()
		const queryClient = router.options.context.queryClient
		queryClient.clear()
		const first = submissionQueries.list({}, 'first-owner')
		await queryClient.query(first)
		const second = submissionQueries.list({}, 'second-owner')
		expect(queryClient.getQueryData(second.queryKey)).toBeUndefined()
		await queryClient.query(second)
		expect(rpc).toHaveBeenCalledTimes(2)
	})
	it('redirects the anonymous submission overview before loading owner data', async () => {
		getAuthFn.mockResolvedValue(null)
		const router = routerAt('/submission')
		await router.load()
		expect(router.state.location.pathname).toBe('/auth/sign-in')
		expect(router.state.location.search).toEqual({ returnTo: '/submission' })
		expect(rpc).not.toHaveBeenCalled()
	})
	it('loads the owner endpoint for regular users, using validated search params', async () => {
		getAuthFn.mockResolvedValue({
			user: { id: 'owner-id', role: 'user' },
			session: {},
		})
		const router = routerAt('/submission?q=Review&page=2&limit=10')
		await router.load()
		expect(router.state.location.pathname).toBe('/submission')
		expect(rpc).toHaveBeenCalledWith(
			['submission', 'list'],
			{ query: { q: 'Review', page: 2, limit: 10 } },
			expect.anything()
		)
		expect(
			rpc.mock.calls.some(
				([route]) =>
					Array.isArray(route) && route.join('/').startsWith('admin/project')
			)
		).toBe(false)
		expect(router.state.matches.at(-1)?.status).toBe('success')
	})
	it('redirects anonymous submissions to sign-in with the return URL', async () => {
		getAuthFn.mockResolvedValue(null)
		const router = routerAt('/submit')
		await router.load()
		expect(router.state.location.pathname).toBe('/auth/sign-in')
		expect(router.state.location.search).toEqual({ returnTo: '/submit' })
		expect(rpc).not.toHaveBeenCalled()
	})
	it('allows a regular logged-in user to submit', async () => {
		getAuthFn.mockResolvedValue({ user: { role: 'user' }, session: {} })
		const router = routerAt('/submit')
		await router.load()
		expect(router.state.location.pathname).toBe('/submit')
		expect(router.state.matches.at(-1)?.status).toBe('success')
	})
	it.each([
		'/projects',
		'/projects/create',
		'/projects/550e8400-e29b-41d4-a716-446655440000/edit',
	])(
		'blocks review route %s and private loaders for regular users',
		async (path) => {
			getAuthFn.mockResolvedValue({ user: { role: 'user' }, session: {} })
			const router = routerAt(path)
			await router.load()
			expect(router.state.location.pathname).toBe('/')
			expect(
				rpc.mock.calls.some(
					([route]) =>
						Array.isArray(route) && route.join('/').startsWith('admin/project')
				)
			).toBe(false)
		}
	)
})
