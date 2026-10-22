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
			VITE_APP_URL: 'http://localhost:3010',
			VITE_SERVER_URL: 'http://localhost:3001',
			VITE_S3_PUBLIC_URL: 'https://storage.test',
		},
	}
})

vi.mock('#/routes/_app/index', async () => {
	const { createFileRoute } = await import('@tanstack/react-router')
	return { Route: createFileRoute('/_app/')({ component: () => null }) }
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

const first = {
	id: '550e8400-e29b-41d4-a716-446655440001',
	name: 'First Tool',
	slug: 'first',
	logo: null,
	tagline: 'First tagline',
	websiteUrl: 'https://first.example.test',
	status: 'published',
}
const second = {
	...first,
	id: '550e8400-e29b-41d4-a716-446655440002',
	name: 'Second Tool',
	slug: 'second',
}
let selection = [first]
const routers: Array<ReturnType<typeof getRouter>> = []
beforeEach(() => {
	vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
	getAuthFn
		.mockReset()
		.mockResolvedValue({ user: { id: 'reviewer', role: 'admin' }, session: {} })
	selection = [first]
	rpc.mockReset().mockImplementation((path, input) => {
		if (path.join('/') === 'admin/featured/list') {
			return Promise.resolve({ projects: selection })
		}
		if (path.join('/') === 'admin/project/list') {
			return Promise.resolve({
				projects: [
					first,
					second,
					{
						...first,
						id: 'missing',
						name: 'Missing Website',
						websiteUrl: null,
					},
				],
				pagination: {
					page: 1,
					totalItems: 3,
					totalPages: 1,
					hasPreviousPage: false,
					hasNextPage: false,
				},
			})
		}
		if (path.join('/') === 'admin/featured/update') {
			const { body } = input as { body: { projectIds: Array<string> } }
			selection = body.projectIds.map((id) =>
				[first, second].find((item) => item.id === id)!
			)
			return Promise.resolve({ projects: selection })
		}
		return Promise.reject(new Error('Unexpected RPC ' + path.join('/')))
	})
})
afterEach(() => {
	cleanup()
	routers
		.splice(0)
		.forEach((router) => router.options.context.queryClient.clear())
	vi.restoreAllMocks()
})
async function routerAt(show = true) {
	const router = getRouter()
	routers.push(router)
	router.update({
		context: router.options.context,
		history: createMemoryHistory({ initialEntries: ['/admin/featured'] }),
	})
	await act(async () => {
		await router.load()
		if (show) render(<RouterProvider router={router} />)
	})
	return router
}
describe('admin featured selection route', () => {
	it('keeps the selected list when candidate loading fails and retries in place', async () => {
		const normal = rpc.getMockImplementation()!
		let fail = true
		rpc.mockImplementation((path, input) => {
			if (path.join('/') === 'admin/project/list' && fail) {
				fail = false
				return Promise.reject(new Error('Synthetic candidate load failure'))
			}
			return normal(path, input)
		})
		await routerAt()
		await screen.findByText('Unable to load projects')
		expect(
			screen.getByRole('button', { name: 'Remove First Tool from featured' })
		).toBeTruthy()
		fireEvent.click(
			screen.getByRole('button', { name: 'Retry project search' })
		)
		await screen.findByRole('button', { name: 'Add Second Tool to featured' })
		expect(screen.queryByText('Unable to load projects')).toBeNull()
	})
	it('adds/reorders/removes with explicit Save and links to the existing project editor', async () => {
		await routerAt()
		await screen.findByRole('table', { name: 'Featured selection' })
		expect(
			screen.getByRole('link', { name: 'First Tool' }).getAttribute('href')
		).toBe('/projects/' + first.id + '/edit')
		expect(
			screen
				.getByRole('button', { name: 'Add Missing Website to featured' })
				.hasAttribute('disabled')
		).toBe(true)
		fireEvent.click(
			screen.getByRole('button', { name: 'Add Second Tool to featured' })
		)
		fireEvent.click(screen.getByRole('button', { name: 'Move Second Tool up' }))
		expect(
			rpc.mock.calls.filter(
				([path]) => path.join('/') === 'admin/featured/update'
			)
		).toHaveLength(0)
		fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
		await waitFor(() =>
			expect(selection.map(({ id }) => id)).toEqual([second.id, first.id])
		)
		expect(
			rpc.mock.calls.find(
				([path]) => path.join('/') === 'admin/featured/update'
			)?.[1]
		).toEqual({
			body: {
				projectIds: [second.id, first.id],
				expectedProjectIds: [first.id],
			},
		})
		await waitFor(() =>
			expect(
				screen
					.getByRole('button', { name: 'Save changes' })
					.hasAttribute('disabled')
			).toBe(true)
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Remove Second Tool from featured' })
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Remove First Tool from featured' })
		)
		expect(screen.getByText('No featured projects selected')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
		await waitFor(() => expect(selection).toEqual([]))
	})
	it('preserves unsaved choices after a concurrent-update error and reloads explicitly', async () => {
		const normal = rpc.getMockImplementation()!
		rpc.mockImplementation(async (path, input) => {
			if (path.join('/') === 'admin/featured/update') {
				throw new Error(
					'Featured projects changed. Reload the selection before saving.'
				)
			}
			return normal(path, input)
		})
		await routerAt()
		fireEvent.click(
			await screen.findByRole('button', { name: 'Add Second Tool to featured' })
		)
		fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
		await screen.findByText(
			'Featured projects changed. Reload the selection before saving.'
		)
		expect(
			screen.getByRole('button', { name: 'Remove Second Tool from featured' })
		).toBeTruthy()
		fireEvent.click(
			screen.getByRole('button', { name: 'Discard changes and reload' })
		)
		await waitFor(() =>
			expect(
				screen.queryByRole('button', {
					name: 'Remove Second Tool from featured',
				})
			).toBeNull()
		)
	})
	it.each([null, { user: { id: 'user', role: 'user' as const }, session: {} }])(
		'redirects non-admin sessions without reading selections',
		async (auth) => {
			getAuthFn.mockResolvedValue(auth)
			const router = await routerAt(false)
			expect(router.state.location.pathname).toBe(auth ? '/' : '/auth/sign-in')
			expect(rpc).not.toHaveBeenCalled()
		}
	)
})
