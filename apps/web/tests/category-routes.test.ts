import { createMemoryHistory } from '@tanstack/react-router'
// @vitest-environment jsdom
import type * as StartModule from '@tanstack/react-start'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterClient } from '@altstack/api/routers'

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
			{ id: flat.id },
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
