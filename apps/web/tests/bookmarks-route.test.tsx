// @vitest-environment jsdom
import { createORPCClient } from '@orpc/client'
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
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterClient } from '@altstack/api/routers'

import { getRouter } from '#/router'
import type * as MainRouteModule from '#/routes/_main/route'
import type { orpc } from '#/utils/orpc'

const { getAuthFn, rpc } = vi.hoisted(() => {
	return {
		getAuthFn: vi.fn<
			() => Promise<{
				user: { id: string; role: 'user' | 'admin' }
				session: Record<string, never>
			} | null>
		>(),
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
vi.mock('#/routes/_main/route', async () => {
	const actual = await vi.importActual<typeof MainRouteModule>(
		'#/routes/_main/route'
	)
	const { Outlet } = await import('@tanstack/react-router')
	actual.Route.update({ component: Outlet })
	return actual
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
	return { getRequestHeaders: vi.fn() }
})
vi.mock('@altstack/env/web', () => {
	return {
		env: {
			VITE_APP_NAME: 'Altstack',
			VITE_SERVER_URL: 'http://localhost:3001',
			VITE_S3_PUBLIC_URL: 'https://storage.test',
		},
	}
})
vi.mock('@tanstack/react-start', async () => {
	const actual = await vi.importActual<typeof StartModule>(
		'@tanstack/react-start'
	)
	const client = createORPCClient<ORPCRouterClient>({ call: rpc })
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
const id = '550e8400-e29b-41d4-a716-446655440000'
const item = {
	id,
	name: 'Saved Tool',
	slug: 'saved-tool',
	logo: null,
	tagline: 'Short public tagline',
}
let rows = [item]
const routers: Array<ReturnType<typeof getRouter>> = []
beforeEach(() => {
	vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
	getAuthFn
		.mockReset()
		.mockResolvedValue({ user: { id: 'account-a', role: 'user' }, session: {} })
	rows = [item]
	rpc.mockReset().mockImplementation(async (path, input) => {
		if (path.join('/') === 'bookmark/remove') {
			rows = []
			return { bookmarked: false }
		}
		if (path.join('/') === 'bookmark/list') {
			const { listBookmarkInputSchema } =
				await import('@altstack/shared/schemas/bookmark')
			const { query } = listBookmarkInputSchema.parse(input)
			return {
				bookmarks: query.page === 1 ? rows : [],
				pagination: {
					...query,
					totalItems: rows.length,
					totalPages: rows.length > 0 ? 1 : 0,
					hasNextPage: false,
					hasPreviousPage: query.page > 1,
				},
			}
		}
		throw new Error('Unexpected RPC ' + path.join('/'))
	})
})
afterEach(() => {
	cleanup()
	routers
		.splice(0)
		.forEach((router) => router.options.context.queryClient.clear())
	vi.restoreAllMocks()
})
async function routerAt(url = '/bookmarks', show = true) {
	const router = getRouter()
	routers.push(router)
	router.update({
		context: router.options.context,
		history: createMemoryHistory({ initialEntries: [url] }),
	})
	await act(async () => {
		await router.load()
		if (show) render(<RouterProvider router={router} />)
	})
	return router
}
describe('protected bookmarks route', () => {
	it.each(['user', 'admin'] as const)(
		'renders saved projects for %s and refreshes the table after Remove',
		async (role) => {
			getAuthFn.mockResolvedValue({
				user: { id: 'account-a', role },
				session: {},
			})
			await routerAt()
			expect(
				screen.getByRole('link', { name: 'Saved Tool' }).getAttribute('href')
			).toBe('/saved-tool')
			fireEvent.click(
				screen.getByRole('button', { name: 'Remove Saved Tool from bookmarks' })
			)
			await screen.findByText('No bookmarks yet')
			expect(screen.queryByRole('link', { name: 'Saved Tool' })).toBeNull()
			expect(
				rpc.mock.calls.filter(([path]) => path.join('/') === 'bookmark/remove')
			).toHaveLength(1)
		}
	)
	it('redirects guests before private RPCs and carries only the safe return path', async () => {
		getAuthFn.mockResolvedValue(null)
		const router = await routerAt(
			'/bookmarks?returnTo=https%3A%2F%2Fevil.test',
			false
		)
		expect(router.state.location.pathname).toBe('/auth/sign-in')
		expect(router.state.location.search).toEqual({ returnTo: '/bookmarks' })
		expect(rpc).not.toHaveBeenCalled()
	})
	it('recovers from loader failures by retrying the actual loader', async () => {
		rpc.mockRejectedValueOnce(new Error('Offline'))
		await routerAt()
		fireEvent.click(
			await screen.findByRole('button', { name: 'Retry loading' })
		)
		expect(await screen.findByRole('link', { name: 'Saved Tool' })).toBeTruthy()
	})
	it('returns to the last valid page when a saved page becomes empty', async () => {
		const router = await routerAt('/bookmarks?page=2&limit=10')
		await screen.findByRole('link', { name: 'Saved Tool' })
		await waitFor(() =>
			expect(router.state.location.search).toMatchObject({ page: 1, limit: 10 })
		)
	})
	it('reads the new account after invalidation without reusing another account cache', async () => {
		const router = await routerAt()
		await screen.findByRole('link', { name: 'Saved Tool' })
		getAuthFn.mockResolvedValue({
			user: { id: 'account-b', role: 'user' },
			session: {},
		})
		rows = []
		await act(async () => {
			await router.invalidate({ sync: true })
		})
		await screen.findByText('No bookmarks yet')
		expect(screen.queryByRole('link', { name: 'Saved Tool' })).toBeNull()
	})
})
