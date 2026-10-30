import { createORPCClient } from '@orpc/client'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { page, userEvent } from 'vite-plus/test/browser'

import type { ORPCRouterClient } from '@altstack/api/routers'

import { adminListReportsInputSchema } from '@altstack/shared/schemas/admin-report'

import { ThemeProvider } from '@altstack/ui/components/customs/theme-provider'

import { AdminPageHeader } from '#/features/admin-dashboard/components/dashboard-state'
import type { AdminProjectSearch } from '#/features/admin-projects/search'
import { ReportInbox } from '#/features/admin-reports/components/report-inbox'
import { SubmissionInbox } from '#/features/admin-submissions/components/submission-inbox'
import { ClaimInbox } from '#/features/project/components/claim-inbox'
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
vi.mock('@altstack/env/web', () => {
	return { env: { VITE_S3_PUBLIC_URL: 'https://storage.test' } }
})
const id = '550e8400-e29b-41d4-a716-446655440001'
const email = 'moderation-fixture@example.test'
const project = {
	id,
	name: 'Community project with a long title for narrow screen checks',
	slug: 'community-project',
	logo: null,
	tagline: 'A project submitted for review.',
	status: 'draft',
	createdAt: new Date(),
	submitter: { id, name: 'Community contributor', email },
}
const claim = {
	id,
	projectId: id,
	projectName: 'Project with a long ownership request title',
	projectSlug: 'community-project',
	name: 'Project representative',
	email,
	role: 'maintainer',
	requestedAt: new Date(),
	githubEvidence: null,
}
const report = {
	id,
	email,
	type: 'other',
	message:
		'A suggested correction with <img src=x onerror=alert(1)> kept as plain text.\nPlease review the project links.',
	createdAt: new Date(),
	status: 'open',
	project: { id, name: project.name, logo: null, status: 'draft' },
}
const pagination = {
	page: 1,
	limit: 12,
	totalItems: 1,
	totalPages: 1,
	hasPreviousPage: false,
	hasNextPage: false,
}
let reviewed = false
let reportStatus = 'open'
const clients: Array<QueryClient> = []
beforeEach(() => {
	reviewed = false
	reportStatus = 'open'
	rpc.mockReset().mockImplementation((path, input) => {
		if (path.join('/') === 'admin/project/list') {
			return Promise.resolve({ projects: [project], pagination })
		}
		if (path.join('/') === 'ownership/inbox') {
			return Promise.resolve({
				claims: reviewed ? [] : [claim],
				pagination: { ...pagination, totalItems: reviewed ? 0 : 1 },
			})
		}
		if (path.join('/') === 'ownership/review') {
			reviewed = true
			return Promise.resolve({ success: true })
		}
		if (path.join('/') === 'admin/report/list') {
			const { query } = adminListReportsInputSchema.parse(input)
			return Promise.resolve({
				reports:
					query.status === 'all' || query.status === reportStatus
						? [{ ...report, status: reportStatus }]
						: [],
				nextCursor: null,
			})
		}
		if (path.join('/') === 'admin/report/moderate') {
			reportStatus = 'resolved'
			return Promise.resolve({ id, status: reportStatus })
		}
		return Promise.reject(new Error('Unexpected RPC: ' + path.join('/')))
	})
})
afterEach(() => {
	cleanup()
	for (const client of clients) client.clear()
	clients.length = 0
	document.documentElement.classList.remove('dark')
	window.scrollTo(0, 0)
})
type Mode = 'submissions' | 'ownership' | 'reports'
function TestPage({ mode }: { mode: Mode }) {
	const [submissionSearch, setSubmissionSearch] = useState<AdminProjectSearch>(
		{}
	)
	const [reportSearch, setReportSearch] = useState<
		ComponentProps<typeof ReportInbox>['search']
	>({})
	const [requestPage, setRequestPage] = useState(1)
	if (mode === 'submissions') {
		return (
			<SubmissionInbox
				search={submissionSearch}
				onSearchChange={setSubmissionSearch}
			/>
		)
	}
	if (mode === 'reports') {
		return (
			<ReportInbox search={reportSearch} onSearchChange={setReportSearch} />
		)
	}
	return (
		<div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
			<AdminPageHeader
				title="Ownership requests"
				description="Verify project representatives and review eligible requests with supporting evidence."
			/>
			<ClaimInbox page={requestPage} onPageChange={setRequestPage} />
		</div>
	)
}
async function mount(mode: Mode, theme = 'light') {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	})
	clients.push(client)
	const root = createRootRoute({ component: Outlet })
	const main = createRoute({
		id: '_main',
		getParentRoute: () => root,
		beforeLoad: () => {
			return { auth: { user: { id, role: 'admin' as const }, session: {} } }
		},
		component: Outlet,
	})
	const child = createRoute({
		path: '/',
		getParentRoute: () => main,
		component: () => <TestPage mode={mode} />,
	})
	const router = createRouter({
		routeTree: root.addChildren([main.addChildren([child])]),
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
	await screen.findByText(email)
	await document.fonts.ready
}
function expectNoOverflow(width: number) {
	expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
}

describe('admin moderation pages in Chromium', () => {
	it.each([320, 768, 1440])(
		'fits submissions, ownership and reports at %ipx in both themes',
		async (width) => {
			await page.viewport(width, 900)
			for (const theme of ['light', 'dark']) {
				for (const mode of ['submissions', 'ownership', 'reports'] as const) {
					await mount(mode, theme)
					window.scrollTo(0, 0)
					expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
						width
					)
					cleanup()
				}
			}
		}
	)
	it('expands verification for one request without submitting a decision', async () => {
		await page.viewport(390, 844)
		rpc.mockResolvedValueOnce({
			claims: [
				claim,
				{
					...claim,
					id: '550e8400-e29b-41d4-a716-446655440002',
					name: 'Another representative',
					email: 'another@example.test',
				},
			],
			pagination: { ...pagination, totalItems: 2 },
		})
		await mount('ownership')
		expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull()
		await page
			.getByRole('button', { name: 'Verification & review' })
			.nth(0)
			.click()
		expect(screen.getAllByRole('button', { name: 'Approve' })).toHaveLength(1)
		expect(
			rpc.mock.calls.some(([path]) => path.join('/') === 'ownership/review')
		).toBe(false)
	})
	it('searches submissions without changing their review scope and clears the filter', async () => {
		await page.viewport(390, 844)
		await mount('submissions')
		await page
			.getByRole('textbox', { name: 'Search project names' })
			.fill('Alpha tools')
		await userEvent.keyboard('{Enter}')
		await screen.findByText('Results for “Alpha tools”')
		expect(
			rpc.mock.calls.some(
				([path, input]) =>
					path.join('/') === 'admin/project/list' &&
					JSON.stringify(input).includes('Alpha tools')
			)
		).toBe(true)
		expect(screen.queryByRole('combobox', { name: 'Filter status' })).toBeNull()
		await page
			.getByRole('button', { name: 'Clear search', exact: true })
			.click()
		await waitFor(() =>
			expect(
				screen.getByRole<HTMLInputElement>('textbox', {
					name: 'Search project names',
				}).value
			).toBe('')
		)
		expect(
			screen
				.getByRole('link', { name: `Review ${project.name}` })
				.getAttribute('href')
		).toBe(`/projects/${id}/edit`)
	})
	it('accepts verification notes inside the confirmation and submits only after confirming', async () => {
		await page.viewport(320, 900)
		await mount('ownership')
		await page.getByRole('button', { name: 'Approve', exact: true }).click()
		await screen.findByRole('dialog', { name: 'Approve project access?' })
		expect(
			screen.getByRole<HTMLButtonElement>('button', {
				name: 'Confirm decision',
			}).disabled
		).toBe(true)
		await page
			.getByRole('textbox', { name: 'Verification notes', exact: true })
			.fill('Confirmed the maintainer through the official project website.')
		expect(
			screen.getByRole<HTMLButtonElement>('button', {
				name: 'Confirm decision',
			}).disabled
		).toBe(false)
		expect(
			rpc.mock.calls.some(([path]) => path.join('/') === 'ownership/review')
		).toBe(false)
		expectNoOverflow(320)
		await page.getByRole('button', { name: 'Confirm decision' }).click()
		await screen.findByText('No requests awaiting your review')
		expect(
			rpc.mock.calls.find(
				([path]) => path.join('/') === 'ownership/review'
			)?.[1]
		).toMatchObject({
			params: { id },
			body: {
				decision: 'approve',
				manualEvidence:
					'Confirmed the maintainer through the official project website.',
			},
		})
	})
	it('lets the reviewer cancel declining without sending a decision', async () => {
		await page.viewport(390, 844)
		await mount('ownership')
		await page.getByRole('button', { name: 'Decline', exact: true }).click()
		await screen.findByRole('dialog', { name: 'Decline access request?' })
		await page.getByRole('button', { name: 'Cancel', exact: true }).click()
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		expect(
			rpc.mock.calls.some(([path]) => path.join('/') === 'ownership/review')
		).toBe(false)
	})
	it('renders report messages as text and resolves an open report', async () => {
		await page.viewport(390, 844)
		await mount('reports')
		expect(
			screen.getByText(report.message, { normalizer: (text) => text })
		).toBeTruthy()
		expect(document.querySelector('img[src="x"]')).toBeNull()
		expect(
			screen.getByRole('link', { name: 'Edit project' }).getAttribute('href')
		).toBe(`/projects/${id}/edit`)
		await page.getByRole('button', { name: 'Resolve', exact: true }).click()
		await screen.findByText('No reports on this page')
		expect(
			rpc.mock.calls.some(
				([path]) => path.join('/') === 'admin/report/moderate'
			)
		).toBe(true)
	})
})
