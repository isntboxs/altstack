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
const intake = {
	id,
	name: 'Original Tool',
	repositoryUrl: 'https://github.com/example/tool',
	websiteUrl: null,
	status: 'rejected',
	rejectionReason: 'Please correct the name.',
	revision: '123',
}
let status: 'rejected' | 'draft'
let savedName: string
const routers: Array<ReturnType<typeof getRouter>> = []
beforeEach(() => {
	vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
	getAuthFn.mockReset().mockResolvedValue({
		user: { id: 'original-submitter', role: 'user' },
		session: {},
	})
	status = 'rejected'
	savedName = intake.name
	rpc.mockReset().mockImplementation(async (path, input) => {
		switch (path.join('/')) {
			case 'submission/list':
				return {
					submissions: [
						{
							...intake,
							name: savedName,
							status,
							rejectionReason:
								status === 'rejected' ? intake.rejectionReason : null,
							logo: null,
							slug: 'original-tool',
							createdAt: new Date(),
						},
					],
					pagination: {
						page: 2,
						limit: 10,
						totalItems: 11,
						totalPages: 2,
						hasNextPage: false,
						hasPreviousPage: true,
					},
				}
			case 'submission/getById':
				return intake
			case 'submission/resubmit': {
				const { resubmitSubmissionInputSchema } =
					await import('@altstack/shared/schemas/submission')
				const { body } = resubmitSubmissionInputSchema.parse(input)
				status = 'draft'
				savedName = body.name
				return { id, status }
			}
			default:
				throw new Error('Unexpected RPC ' + path.join('/'))
		}
	})
})
afterEach(() => {
	cleanup()
	for (const router of routers.splice(0)) {
		router.options.context.queryClient.clear()
	}
	vi.restoreAllMocks()
})
async function routerAt(url: string, show = true) {
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
describe('submission correction navigation', () => {
	it('cancels in place and successfully refreshes Awaiting review without losing search/page or accepting an external return URL', async () => {
		const router = await routerAt(
			'/submission?q=Tool&page=2&limit=10&returnTo=https%3A%2F%2Fevil.test'
		)
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Edit & Resubmit Original Tool',
			})
		)
		await screen.findByLabelText('Project name')
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		expect(router.state.location.pathname).toBe('/submission')
		fireEvent.click(
			screen.getByRole('button', { name: 'Edit & Resubmit Original Tool' })
		)
		await screen.findByLabelText('Project name')
		fireEvent.change(screen.getByLabelText('Project name'), {
			target: { value: 'Corrected Tool' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Resubmit project' }))
		await screen.findByText(
			'Your project has been resubmitted and is awaiting review.'
		)
		expect(screen.queryByRole('dialog')).toBeNull()
		expect(screen.getByText('Awaiting review')).toBeTruthy()
		expect(screen.queryByRole('button', { name: /Edit & Resubmit/ })).toBeNull()
		expect(router.state.location.pathname).toBe('/submission')
		expect(router.state.location.search).toMatchObject({
			q: 'Tool',
			page: 2,
			limit: 10,
		})
		expect(
			rpc.mock.calls.filter(
				([path]) => path.join('/') === 'submission/resubmit'
			)
		).toHaveLength(1)
		await act(async () => {
			await router.invalidate({ sync: true })
		})
		expect(screen.getByText('Corrected Tool')).toBeTruthy()
		expect(screen.getByText('Awaiting review')).toBeTruthy()
	})
	it('redirects an expired session to the existing safe local return path before any private RPC', async () => {
		getAuthFn.mockResolvedValue(null)
		const router = await routerAt(
			'/submission?returnTo=https%3A%2F%2Fevil.test',
			false
		)
		expect(router.state.location.pathname).toBe('/auth/sign-in')
		expect(router.state.location.search).toEqual({ returnTo: '/submission' })
		expect(rpc).not.toHaveBeenCalled()
	})
})
