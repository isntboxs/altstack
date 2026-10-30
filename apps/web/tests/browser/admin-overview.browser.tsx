import { createORPCClient } from '@orpc/client'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router'
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { page, userEvent } from 'vite-plus/test/browser'

import type { ORPCRouterClient, ORPCRouterOutputs } from '@altstack/api/routers'

import { ThemeProvider } from '@altstack/ui/components/customs/theme-provider'

import { AdminOverview } from '#/features/admin-dashboard/components/overview'
import '#/styles.css'

const { rpc } = vi.hoisted(() => {
	return {
		rpc: vi.fn<(path: Array<string>, input: unknown) => Promise<unknown>>(),
	}
})
vi.mock('#/utils/orpc', () => {
	const client = createORPCClient<ORPCRouterClient>({ call: rpc }),
		orpc = createTanstackQueryUtils(client)
	return {
		client,
		orpc,
		adminORPC: orpc.admin,
		projectORPC: orpc.project,
		categoryORPC: orpc.category,
	}
})
const id = '550e8400-e29b-41d4-a716-446655440001'
const at = new Date()
const data: ORPCRouterOutputs['admin']['dashboard']['overview'] = {
	observedAt: at,
	counts: {
		published: 1200,
		needsReview: 3,
		openReports: 2,
		pendingClaims: 1,
		totalProjects: 1231,
		users: 980,
	},
	statuses: [
		{ status: 'published', count: 1200 },
		{ status: 'draft', count: 20 },
		{ status: 'rejected', count: 10 },
		{ status: 'removed', count: 1 },
	],
	submissions: [
		{
			id,
			name: 'Community project with a long name for testing narrow layouts',
			createdAt: new Date(at.getTime() - 2000),
			submitter: { id, name: 'Community contributor' },
		},
	],
	reports: [
		{
			id,
			type: 'incorrect_info',
			createdAt: new Date(at.getTime() - 6000),
			project: {
				id,
				name: 'Reportedprojectwithaverylongunbrokendisplaynameforlayoutchecks',
			},
		},
	],
	claims: [
		{
			id,
			projectId: id,
			projectName: 'Claimed project',
			name: 'Project maintainer',
			role: 'maintainer',
			requestedAt: new Date(at.getTime() - 4000),
		},
	],
}
const clients: Array<QueryClient> = []
beforeEach(() => {
	rpc.mockReset().mockResolvedValue(data)
})
afterEach(() => {
	cleanup()
	for (const client of clients) client.clear()
	clients.length = 0
	document.documentElement.classList.remove('dark')
	window.scrollTo(0, 0)
})
async function mount(theme = 'light', ready = true) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	})
	clients.push(client)
	const root = createRootRoute({
		component: () => <AdminOverview userId={id} />,
	})
	const router = createRouter({
		routeTree: root,
		history: createMemoryHistory({ initialEntries: ['/'] }),
	})
	await router.load()
	render(
		<ThemeProvider attribute="class" forcedTheme={theme}>
			<QueryClientProvider client={client}>
				<main>
					<RouterProvider router={router} />
				</main>
			</QueryClientProvider>
		</ThemeProvider>
	)
	if (ready) await screen.findByRole('tab', { name: /^All/ })
	await document.fonts.ready
}
function expectNoOverflow(width: number) {
	expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
}

describe('admin overview in Chromium', () => {
	it.each([320, 768, 1440])(
		'fits the queues, status chart and tools at %ipx in both themes',
		async (width) => {
			await page.viewport(width, 900)
			for (const theme of ['light', 'dark']) {
				await mount(theme)
				expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
				expect(
					screen
						.getByRole('link', { name: 'Published projects: 1,200' })
						.getAttribute('href')
				).toContain('status=published')
				expect(
					screen
						.getByRole('link', { name: 'Accounts: 980' })
						.getAttribute('href')
				).toBe('/admin/users')
				const list = screen.getByRole('list', { name: 'All review items' })
				expect(within(list).getAllByRole('listitem')[0].textContent).toContain(
					'Reportedproject'
				)
				await page.getByRole('tab', { name: /^Reports/ }).click()
				expect(
					screen.queryByRole('link', {
						name: "Review Project maintainer's claim",
					})
				).toBeNull()
				expectNoOverflow(width)
				cleanup()
			}
		}
	)
	it('supports keyboard queue switching and exposes exact review destinations', async () => {
		await page.viewport(320, 900)
		await mount()
		await page.getByRole('tab', { name: /^All/ }).click()
		await userEvent.keyboard('{ArrowRight}')
		await waitFor(() =>
			expect(
				screen
					.getByRole('tab', { name: /^Submissions/ })
					.getAttribute('aria-selected')
			).toBe('true')
		)
		expect(document.activeElement).toBe(
			screen.getByRole('tab', { name: /^Submissions/ })
		)
		expect(
			screen
				.getByRole('link', { name: /^Review Community project/ })
				.getAttribute('href')
		).toBe(`/projects/${id}/edit`)
		await userEvent.keyboard('{ArrowRight}')
		await waitFor(() =>
			expect(
				screen
					.getByRole('tab', { name: /^Reports/ })
					.getAttribute('aria-selected')
			).toBe('true')
		)
		expect(
			screen.getByRole('link', { name: /^Review report/ }).getAttribute('href')
		).toContain(`reportId=${id}`)
		expectNoOverflow(320)
	})
	it('keeps loaded data after a failed refresh and retries successfully', async () => {
		await page.viewport(1440, 900)
		await mount()
		rpc.mockRejectedValueOnce(new Error('Network unavailable'))
		await page.getByRole('button', { name: 'Refresh', exact: true }).click()
		await screen.findByText('Unable to refresh overview')
		expect(
			screen.getByRole('link', { name: 'Published projects: 1,200' })
		).toBeTruthy()
		await page.getByRole('button', { name: 'Refresh', exact: true }).click()
		await waitFor(() =>
			expect(screen.queryByText('Unable to refresh overview')).toBeNull()
		)
	})
	it('shows loading and retry states without invented counts', async () => {
		rpc.mockImplementationOnce(() => new Promise(() => undefined))
		await mount('light', false)
		expect(screen.getByText('Loading admin overview')).toBeTruthy()
		expect(
			screen.queryByRole('link', { name: /Published projects:/ })
		).toBeNull()
		cleanup()
		rpc.mockRejectedValueOnce(new Error('Offline'))
		await mount('light', false)
		await screen.findByText('Unable to load admin data')
		fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
		await screen.findByRole('link', { name: 'Published projects: 1,200' })
	})
	it('shows empty states for every queue and for an empty catalog', async () => {
		rpc.mockResolvedValue({
			...data,
			counts: {
				published: 0,
				needsReview: 0,
				openReports: 0,
				pendingClaims: 0,
				totalProjects: 0,
				users: 0,
			},
			statuses: data.statuses.map((item) => {
				return { ...item, count: 0 }
			}),
			submissions: [],
			reports: [],
			claims: [],
		})
		await page.viewport(320, 900)
		await mount()
		expect(screen.getByText('All queues are clear')).toBeTruthy()
		expect(screen.getByText('No projects yet')).toBeTruthy()
		await page.getByRole('tab', { name: /^Reports/ }).click()
		expect(screen.getByText('No open reports')).toBeTruthy()
		expectNoOverflow(320)
	})
})
