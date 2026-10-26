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

vi.mock('@tanstack/react-table-devtools', () => {
	return {
		useTanStackTableDevtools: vi.fn(),
	}
})
const id = '550e8400-e29b-41d4-a716-446655440000'
const actorId = '550e8400-e29b-41d4-a716-446655440001'
const at = new Date('2026-10-26T08:00:00Z')
const pagination = {
	page: 1,
	limit: 12,
	totalItems: 0,
	totalPages: 0,
	hasNextPage: false,
	hasPreviousPage: false,
}
const overview = {
	observedAt: at,
	counts: {
		published: 12,
		needsReview: 3,
		openReports: 2,
		pendingClaims: 1,
		totalProjects: 17,
		users: 9,
	},
	statuses: [
		{ status: 'published', count: 12 },
		{ status: 'draft', count: 3 },
		{ status: 'rejected', count: 2 },
		{ status: 'removed', count: 0 },
	],
	submissions: [
		{
			id,
			name: 'Review tool',
			createdAt: at,
			submitter: { id: actorId, name: 'Representative' },
		},
	],
	reports: [
		{
			id,
			type: 'outdated',
			createdAt: at,
			project: { id, name: 'Reported tool' },
		},
	],
	claims: [
		{
			id,
			projectId: id,
			projectName: 'Claimed tool',
			name: 'Claimant',
			role: 'owner',
			requestedAt: at,
		},
	],
}
const routers: Array<ReturnType<typeof getRouter>> = []
beforeEach(() => {
	vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
		width: 640,
		height: 320,
		top: 0,
		left: 0,
		bottom: 320,
		right: 640,
		x: 0,
		y: 0,
		toJSON: () => {
			return {}
		},
	})
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe = vi.fn()
			unobserve = vi.fn()
			disconnect = vi.fn()
		}
	)
	getAuthFn
		.mockReset()
		.mockResolvedValue({ user: { id: actorId, role: 'admin' }, session: {} })
	rpc.mockReset().mockImplementation(async (path) => {
		await Promise.resolve()
		switch (path.join('/')) {
			case 'admin/dashboard/overview':
				return overview
			case 'admin/project/list':
				return { projects: [], pagination }
			case 'ownership/inbox':
				return { claims: [], pagination }
			case 'admin/dashboard/activity':
				return {
					events: [
						{
							id,
							action: 'project_status_changed',
							createdAt: at,
							actor: { id: actorId, name: 'Reviewer' },
							project: { id, name: 'Reviewed tool' },
							targetUser: null,
							details: {
								fromStatus: 'draft',
								toStatus: 'published',
								role: null,
								previousRole: null,
							},
						},
					],
					page: 1,
					totalItems: 21,
					totalPages: 2,
				}
			case 'admin/dashboard/operations':
				return {
					observedAt: at,
					github: {
						total: 12,
						fresh: 10,
						stale: 1,
						missing: 1,
						latestFetchedAt: at,
						oldestFetchedAt: at,
						staleAfterHours: 48,
						failureTelemetry: 'unavailable',
					},
					outbox: {
						pending: 2,
						failed: 1,
						sent: 8,
						cancelled: 0,
						due: 1,
						oldestPendingAt: at,
						lastSentAt: at,
					},
				}
			default:
				throw new Error('Unexpected RPC ' + path.join('/'))
		}
	})
})
afterEach(() => {
	cleanup()
	routers
		.splice(0)
		.forEach((router) => router.options.context.queryClient.clear())
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})
async function routerAt(path: string, show = true) {
	const router = getRouter()
	routers.push(router)
	router.update({
		context: router.options.context,
		history: createMemoryHistory({ initialEntries: [path] }),
	})
	await act(async () => {
		await router.load()
		if (show) render(<RouterProvider router={router} />)
	})
	return router
}

describe('admin dashboard routes', () => {
	it('renders actual KPI values, filtered destinations, precise work links, and create actions', async () => {
		await routerAt('/admin')
		const published = await screen.findByRole('link', {
			name: 'Published projects: 12',
		})
		expect(published.getAttribute('href')).toContain('status=published')
		expect(
			screen
				.getByRole('link', { name: 'Submissions to review: 3' })
				.getAttribute('href')
		).toBe('/admin/submissions')
		expect(
			screen.getByRole('link', { name: 'Create project' }).getAttribute('href')
		).toBe('/projects/create')
		expect(
			screen.getByRole('link', { name: 'Create category' }).getAttribute('href')
		).toBe('/admin/categories/create')
		expect(
			screen
				.getByRole('link', { name: 'Review report for Reported tool' })
				.getAttribute('href')
		).toContain('reportId=' + id)
		expect(
			screen
				.getByRole('link', { name: "Review Claimant's claim" })
				.getAttribute('href')
		).toContain('claimId=' + id)
		expect(
			screen.getByText('Current project distribution by status')
		).toBeTruthy()
	})
	it('keeps catalog filters across reload and history navigation', async () => {
		const router = await routerAt(
			'/projects?status=published&name=Alpha&page=2&sort=name&order=asc'
		)
		await screen.findByRole('textbox', { name: 'Search project names' })
		await waitFor(() =>
			expect(rpc).toHaveBeenCalledWith(
				['admin', 'project', 'list'],
				{
					query: {
						page: 2,
						limit: 12,
						name: 'Alpha',
						status: 'published',
						sort: 'name',
						order: 'asc',
						needsReview: undefined,
					},
				},
				expect.anything()
			)
		)
		fireEvent.change(
			screen.getByRole('textbox', { name: 'Search project names' }),
			{ target: { value: 'Beta' } }
		)
		await waitFor(() =>
			expect(router.state.location.search).toMatchObject({
				status: 'published',
				name: 'Beta',
				page: 1,
			})
		)
		act(() => router.history.back())
		await waitFor(() =>
			expect(
				screen.getByRole('textbox', { name: 'Search project names' })
			).toHaveProperty('value', 'Alpha')
		)
		act(() => router.history.forward())
		await waitFor(() =>
			expect(
				screen.getByRole('textbox', { name: 'Search project names' })
			).toHaveProperty('value', 'Beta')
		)
		const location = router.state.location.href
		cleanup()
		await routerAt(location)
		expect(
			await screen.findByRole('textbox', { name: 'Search project names' })
		).toHaveProperty('value', 'Beta')
	})
	it('locks submissions to needs-review and resolves ownership deep links after reload', async () => {
		await routerAt('/admin/submissions?status=published&page=2')
		await screen.findByRole('heading', { name: 'Submissions' })
		await waitFor(() =>
			expect(
				rpc.mock.calls.find(
					([path]) => path.join('/') === 'admin/project/list'
				)?.[1]
			).toMatchObject({
				query: { page: 2, needsReview: true, status: undefined },
			})
		)
		expect(screen.queryByRole('combobox', { name: 'Filter status' })).toBeNull()
		cleanup()
		await routerAt('/admin/ownership?claimId=' + id)
		await screen.findByText('No requests awaiting your review')
		expect(rpc).toHaveBeenCalledWith(
			['ownership', 'inbox'],
			{ query: { page: 1, limit: 25, claimId: id } },
			expect.anything()
		)
	})
	it('keeps audit filters in URL and exposes only safe event details', async () => {
		const router = await routerAt(
			'/admin/activity?action=project_status_changed&actorId=' +
				actorId +
				'&from=2026-10-20&to=2026-10-26'
		)
		await screen.findByRole('table', { name: 'Recorded audit activity' })
		expect(
			rpc.mock.calls.find(
				([path]) => path.join('/') === 'admin/dashboard/activity'
			)?.[1]
		).toMatchObject({
			query: {
				action: 'project_status_changed',
				actorId,
				from: '2026-10-20',
				to: '2026-10-26',
			},
		})
		fireEvent.click(screen.getByRole('button', { name: 'Details' }))
		await screen.findByRole('dialog', { name: 'project status changed' })
		expect(screen.getByText('draft → published')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Close' }))
		fireEvent.click(screen.getByRole('button', { name: 'Next' }))
		await waitFor(() =>
			expect(router.state.location.search).toMatchObject({
				page: 2,
				actorId,
				action: 'project_status_changed',
			})
		)
	})
	it('shows operational freshness, outbox counts, and unavailable failure telemetry', async () => {
		await routerAt('/admin/operations')
		await screen.findByText('Batch failures / scheduler health')
		expect(screen.getByText('Unavailable')).toBeTruthy()
		expect(
			screen.getByText('Failed notifications need investigation')
		).toBeTruthy()
		expect(screen.queryByRole('button', { name: /retry|execute/i })).toBeNull()
	})
	it('offers a retry on overview errors without fabricated zero KPIs', async () => {
		rpc.mockRejectedValueOnce(new Error('Offline'))
		await routerAt('/admin')
		await screen.findByText('Unable to load admin data')
		expect(
			screen.queryByRole('link', { name: 'Published projects: 0' })
		).toBeNull()
		fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
		await screen.findByRole('link', { name: 'Published projects: 12' })
	})
	it.each([
		'/admin',
		'/admin/activity',
		'/admin/operations',
		'/admin/ownership',
		'/admin/submissions',
	])('blocks non-admin %s before reading private data', async (path) => {
		getAuthFn.mockResolvedValue({
			user: { id: actorId, role: 'user' },
			session: {},
		})
		const router = await routerAt(path, false)
		expect(router.state.location.pathname).toBe('/')
		expect(rpc).not.toHaveBeenCalled()
	})
})
