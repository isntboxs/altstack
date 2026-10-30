import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type * as RouterModule from '@tanstack/react-router'
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'
// @vitest-environment jsdom
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { SidebarProvider } from '@altstack/ui/components/sidebar'

import { MainSidebarContent } from '#/components/main-sidebar-content'
import { submissionSearchSchema } from '#/features/submissions/search'

const { loadOverview } = vi.hoisted(() => {
	return {
		loadOverview: vi.fn<
			() => Promise<{
				counts: {
					needsReview: number
					pendingClaims: number
					openReports: number
				}
			}>
		>(),
	}
})

vi.mock('#/features/admin-dashboard/queries', () => {
	return {
		dashboardQueries: {
			overview: () => {
				return {
					queryKey: ['test-admin-overview'],
					queryFn: loadOverview,
					retry: false,
				}
			},
		},
	}
})

const auth = vi.hoisted(() => {
	return { role: 'user' }
})
vi.mock('@tanstack/react-router', async () => {
	const { CatchBoundary } = await vi.importActual<typeof RouterModule>(
		'@tanstack/react-router'
	)
	return {
		CatchBoundary,
		linkOptions: (options: unknown) => options,
		Link: ({
			to,
			children,
			icon: _icon,
			label: _label,
			activeOptions: _active,
			viewTransition: _transition,
			...props
		}: ComponentProps<'a'> & {
			to: string
			icon?: unknown
			label?: string
			activeOptions?: unknown
			viewTransition?: unknown
		}) => (
			<a href={to} {...props}>
				{children}
			</a>
		),
		useMatchRoute: () => () => false,
		useRouteContext: () => {
			return { auth: { user: { id: 'reviewer', role: auth.role } } }
		},
	}
})
afterEach(cleanup)
beforeEach(() => {
	loadOverview.mockReset().mockResolvedValue({
		counts: { needsReview: 3, pendingClaims: 2, openReports: 1 },
	})
	vi.stubGlobal('matchMedia', () => {
		return {
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}
	})
})
afterEach(() => vi.unstubAllGlobals())

describe('role-specific navigation', () => {
	it('recovers unavailable moderation counts through retry without hiding navigation', async () => {
		auth.role = 'admin'
		loadOverview.mockRejectedValueOnce(new Error('Temporary outage'))
		const client = new QueryClient({
			defaultOptions: { queries: { retry: false } },
		})
		const view = render(
			<QueryClientProvider client={client}>
				<SidebarProvider>
					<MainSidebarContent />
				</SidebarProvider>
			</QueryClientProvider>
		)
		try {
			const retry = await screen.findByRole('button', { name: 'Retry counts' })
			expect(screen.getAllByLabelText('Count unavailable')).toHaveLength(3)
			for (const name of [
				'Overview',
				'Submissions',
				'Ownership requests',
				'Reports',
				'Bookmarks',
			]) {
				expect(screen.getByRole('link', { name })).toBeTruthy()
			}
			const pending = Promise.withResolvers<{
				counts: {
					needsReview: number
					pendingClaims: number
					openReports: number
				}
			}>()
			loadOverview.mockImplementationOnce(() => pending.promise)
			fireEvent.click(retry)
			await waitFor(() => expect(loadOverview).toHaveBeenCalledTimes(2))
			expect(screen.getByRole('link', { name: 'Submissions' })).toBeTruthy()
			expect(screen.getAllByLabelText('Count unavailable')).toHaveLength(3)
			pending.resolve({
				counts: { needsReview: 3, pendingClaims: 2, openReports: 1 },
			})
			await screen.findByLabelText('3 awaiting review')
			expect(screen.getByLabelText('2 awaiting review')).toBeTruthy()
			expect(screen.getByLabelText('1 awaiting review')).toBeTruthy()
			expect(screen.queryByLabelText('Count unavailable')).toBeNull()
			expect(screen.queryByRole('button', { name: 'Retry counts' })).toBeNull()
			expect(loadOverview).toHaveBeenCalledTimes(2)
		} finally {
			view.unmount()
			client.clear()
		}
	})
	it('shows Submission for regular users and full moderation navigation for admins', () => {
		auth.role = 'user'
		const view = render(
			<QueryClientProvider client={new QueryClient()}>
				<SidebarProvider>
					<MainSidebarContent />
				</SidebarProvider>
			</QueryClientProvider>
		)
		expect(
			screen.getByText('Submission').closest('a')?.getAttribute('href')
		).toBe('/submission')
		expect(screen.queryByText('Projects')).toBeNull()
		expect(
			screen.getByRole('link', { name: 'Bookmarks' }).getAttribute('href')
		).toBe('/bookmarks')
		auth.role = 'admin'
		view.rerender(
			<QueryClientProvider client={new QueryClient()}>
				<SidebarProvider>
					<MainSidebarContent />
				</SidebarProvider>
			</QueryClientProvider>
		)
		expect(
			screen.getByText('Projects').closest('a')?.getAttribute('href')
		).toBe('/projects')
		expect(screen.getByText('Categories')).toBeTruthy()
		expect(screen.queryByText('Submission')).toBeNull()
		expect(
			screen.getByRole('link', { name: 'Bookmarks' }).getAttribute('href')
		).toBe('/bookmarks')
	})
	it.each(['owner', 'maintainer'])(
		'preserves personal workspace access for %s',
		(role) => {
			auth.role = role
			render(
				<QueryClientProvider client={new QueryClient()}>
					<SidebarProvider>
						<MainSidebarContent />
					</SidebarProvider>
				</QueryClientProvider>
			)
			expect(
				screen.getByRole('link', { name: 'My projects' }).getAttribute('href')
			).toBe('/managed')
			expect(
				screen.getByRole('link', { name: 'Submission' }).getAttribute('href')
			).toBe('/submission')
			expect(screen.queryByRole('link', { name: 'Overview' })).toBeNull()
			expect(screen.queryByText('Administration')).toBeNull()
		}
	)
	it('preserves entered search text and normalizes malformed pagination', () => {
		expect(
			submissionSearchSchema.parse({ q: '  project  ', page: -1, limit: 999 })
		).toEqual({ q: '  project  ', page: 1, limit: 25 })
		expect(
			submissionSearchSchema.parse({ q: 'x'.repeat(101), page: 2, limit: 10 })
		).toEqual({ q: '', page: 2, limit: 10 })
	})
})
