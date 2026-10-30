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

import { toast } from '@altstack/ui/components/toast'

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

const id = '550e8400-e29b-41d4-a716-446655440000'
const projectId = '550e8400-e29b-41d4-a716-446655440001'
const deletedId = '550e8400-e29b-41d4-a716-446655440002'
const item = {
	id,
	email: 'private-guest@example.test',
	type: 'other',
	message: '<img src=x onerror=alert(1)> plain correction',
	createdAt: new Date('2026-10-21T10:00:00Z'),
	status: 'open',
	project: {
		id: projectId,
		name: 'Unpublished Tool',
		logo: null,
		status: 'draft',
	},
}
let rows = [item]
const routers: Array<ReturnType<typeof getRouter>> = []
beforeEach(() => {
	vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
	getAuthFn
		.mockReset()
		.mockResolvedValue({ user: { id: 'reviewer', role: 'admin' }, session: {} })
	rows = [item]
	rpc.mockReset().mockImplementation(async (path, input) => {
		if (path.join('/') === 'admin/report/moderate') {
			const data = input as { params: { id: string }; body: { status: string } }
			rows = rows.map((row) =>
				row.id === data.params.id ? { ...row, status: data.body.status } : row
			)
			return { id: data.params.id, status: data.body.status }
		}
		if (path.join('/') === 'admin/report/list') {
			const { adminListReportsInputSchema } =
				await import('@altstack/shared/schemas/admin-report')
			const { query } = adminListReportsInputSchema.parse(input)
			return {
				reports: rows.filter(
					(row) => query.status === 'all' || row.status === query.status
				),
				nextCursor: null,
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
async function routerAt(show = true) {
	const router = getRouter()
	routers.push(router)
	router.update({
		context: router.options.context,
		history: createMemoryHistory({ initialEntries: ['/admin/reports'] }),
	})
	await act(async () => {
		await router.load()
		if (show) render(<RouterProvider router={router} />)
	})
	return router
}
async function filter(label: string) {
	fireEvent.click(
		screen.getByRole('combobox', { name: 'Filter report status' })
	)
	const option = await screen.findByRole('option', { name: label })
	fireEvent.pointerDown(option)
	fireEvent.click(option)
}
describe('admin report inbox route', () => {
	it('renders private reports as plain text with the existing unpublished-project edit destination', async () => {
		await routerAt()
		await screen.findByRole('region', { name: 'Project reports' })
		expect(
			screen.getByRole('heading', { name: item.project.name })
		).toBeTruthy()
		expect(screen.getByRole('heading', { name: 'Reported issue' })).toBeTruthy()
		expect(screen.getByText(item.email)).toBeTruthy()
		expect(screen.getByText(item.message)).toBeTruthy()
		expect(document.querySelector('img[src="x"]')).toBeNull()
		expect(screen.getByText('draft')).toBeTruthy()
		expect(
			screen.getByRole('link', { name: 'Edit project' }).getAttribute('href')
		).toBe(`/projects/${projectId}/edit`)
		expect(rpc).toHaveBeenCalledWith(
			['admin', 'report', 'list'],
			expect.objectContaining({ query: { status: 'open', limit: 12 } }),
			expect.anything()
		)
	})
	it.each(['resolved', 'dismissed'])(
		'persists %s, invalidates the inbox and shows terminal rows without moderation actions',
		async (status) => {
			await routerAt()
			fireEvent.click(
				await screen.findByRole('button', {
					name: status === 'resolved' ? 'Resolve' : 'Dismiss',
				})
			)
			await screen.findByText('No reports on this page')
			expect(
				rpc.mock.calls.filter(
					([path]) => path.join('/') === 'admin/report/list'
				).length
			).toBeGreaterThan(1)
			await filter(status === 'resolved' ? 'Resolved' : 'Dismissed')
			await screen.findByText(item.email)
			expect(screen.queryByRole('button', { name: 'Resolve' })).toBeNull()
			expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
		}
	)
	it('keeps reports without project targets visible and offers no broken edit link', async () => {
		rpc.mockResolvedValue({
			reports: [{ ...item, id: deletedId, project: null }],
			nextCursor: null,
		})
		await routerAt()
		await screen.findByText('Project deleted')
		expect(screen.getByText(item.email)).toBeTruthy()
		expect(screen.queryByRole('link', { name: 'Edit project' })).toBeNull()
		expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy()
	})
	it('disables repeat decisions until persistence and invalidation finish', async () => {
		let finish!: (value: unknown) => void
		const handler = rpc.getMockImplementation()!
		rpc.mockImplementation((path, input, ...rest) =>
			path.at(-1) === 'moderate'
				? new Promise((resolve) => {
						finish = resolve
					})
				: handler(path, input, ...rest)
		)
		await routerAt()
		fireEvent.click(await screen.findByRole('button', { name: 'Resolve' }))
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveProperty(
				'disabled',
				true
			)
		)
		fireEvent.click(screen.getByRole('button', { name: 'Resolve' }))
		expect(
			rpc.mock.calls.filter(([path]) => path.at(-1) === 'moderate')
		).toHaveLength(1)
		act(() => {
			finish({ id, status: 'resolved' })
		})
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveProperty(
				'disabled',
				false
			)
		)
	})
	it('retains the report and provides retry feedback on moderation failure', async () => {
		const handler = rpc.getMockImplementation()!
		rpc.mockImplementation((path, input, ...rest) =>
			path.at(-1) === 'moderate'
				? Promise.reject(new Error('Offline'))
				: handler(path, input, ...rest)
		)
		await routerAt()
		fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }))
		await screen.findByText('Unable to update report')
		expect(screen.getByText(item.email)).toBeTruthy()
		expect(
			rpc.mock.calls.filter(([path]) => path.at(-1) === 'moderate')
		).toHaveLength(1)
	})
	it('refreshes a concurrent decision and keeps conflict feedback after the Open row disappears', async () => {
		const feedback = vi.spyOn(toast, 'add')
		const handler = rpc.getMockImplementation()!
		rpc.mockImplementation((path, input, ...rest) => {
			if (path.at(-1) !== 'moderate') return handler(path, input, ...rest)
			rows = [{ ...item, status: 'resolved' }]
			return Promise.reject(
				Object.assign(new Error('Already reviewed'), { code: 'CONFLICT' })
			)
		})
		await routerAt()
		fireEvent.click(await screen.findByRole('button', { name: 'Dismiss' }))
		await screen.findByText('No reports on this page')
		expect(feedback).toHaveBeenCalledWith({
			type: 'error',
			title: 'Unable to update report',
			description:
				'Another admin has already reviewed this report. The inbox has been refreshed.',
		})
		expect(
			rpc.mock.calls.filter(([path]) => path.at(-1) === 'moderate')
		).toHaveLength(1)
	})
	it('shows a pending state, recovers from read errors and handles an empty inbox', async () => {
		let finish!: (value: unknown) => void
		rpc.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve
				})
		)
		await routerAt()
		expect(
			await screen.findByRole('status', { name: 'Loading reports' })
		).toBeTruthy()
		act(() => {
			finish({ reports: [], nextCursor: null })
		})
		await screen.findByText('No reports on this page')
		rpc.mockRejectedValueOnce(new Error('Offline'))
		fireEvent.click(screen.getByRole('button', { name: 'Refresh inbox' }))
		fireEvent.click(
			await screen.findByRole('button', { name: 'Retry loading' })
		)
		await screen.findByText(item.email)
	})
	it.each([1, 2, 3])(
		'refetches cached report pages when refreshing from page %i',
		async (currentPage) => {
			// Keep every cache entry within the shared 30-second freshness window.
			vi.spyOn(Date, 'now').mockReturnValue(Date.now())
			const pageIds = [id, projectId, deletedId]
			let refreshed = false
			rpc.mockImplementation(async (path, input) => {
				if (path.join('/') !== 'admin/report/list') {
					throw new Error('Unexpected RPC')
				}
				const { adminListReportsInputSchema } =
					await import('@altstack/shared/schemas/admin-report')
				const { query } = adminListReportsInputSchema.parse(input)
				const pageIndex = query.cursor ? pageIds.indexOf(query.cursor) + 1 : 0
				return {
					reports: [
						{
							...item,
							id: pageIds[pageIndex],
							message: `${refreshed ? 'Fresh' : 'Cached'} page ${pageIndex + 1}`,
						},
					],
					nextCursor:
						pageIndex < pageIds.length - 1 ? pageIds[pageIndex] : null,
				}
			})
			await routerAt()
			await screen.findByText('Cached page 1')
			for (let page = 2; page <= currentPage; page++) {
				fireEvent.click(screen.getByRole('button', { name: 'Next' }))
				await screen.findByText(`Cached page ${page}`)
			}
			refreshed = true
			fireEvent.click(screen.getByRole('button', { name: 'Refresh inbox' }))
			await screen.findByText('Fresh page 1')
			expect(screen.getByText('Newest first · Page 1')).toBeTruthy()
			for (let page = 2; page <= currentPage; page++) {
				fireEvent.click(screen.getByRole('button', { name: 'Next' }))
				await screen.findByText(`Fresh page ${page}`)
			}
			for (let page = currentPage - 1; page >= 1; page--) {
				fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
				await screen.findByText(`Fresh page ${page}`)
			}
			expect(
				rpc.mock.calls.filter(
					([path]) => path.join('/') === 'admin/report/list'
				)
			).toHaveLength(currentPage * 2)
		}
	)
	it('pages with cursors and resets to the first page when the status changes', async () => {
		rpc.mockResolvedValueOnce({ reports: [item], nextCursor: id })
		await routerAt()
		await screen.findByText(item.email)
		fireEvent.click(screen.getByRole('button', { name: 'Next' }))
		await screen.findByText('Newest first · Page 2')
		await waitFor(() =>
			expect(rpc).toHaveBeenCalledWith(
				['admin', 'report', 'list'],
				{ query: { status: 'open', limit: 12, cursor: id } },
				expect.anything()
			)
		)
		await filter('All statuses')
		await screen.findByText('Newest first · Page 1')
		await waitFor(() =>
			expect(rpc).toHaveBeenLastCalledWith(
				['admin', 'report', 'list'],
				{ query: { status: 'all', limit: 12 } },
				expect.anything()
			)
		)
		expect(screen.getByRole('button', { name: 'Previous' })).toHaveProperty(
			'disabled',
			true
		)
	})
	it.each(['guest', 'user'])(
		'redirects %s before making any private RPC',
		async (role) => {
			getAuthFn.mockResolvedValue(
				role === 'guest'
					? null
					: { user: { id: 'regular', role: 'user' }, session: {} }
			)
			const router = await routerAt(false)
			expect(router.state.location.pathname).toBe(
				role === 'guest' ? '/auth/sign-in' : '/'
			)
			expect(rpc).not.toHaveBeenCalled()
		}
	)
})
