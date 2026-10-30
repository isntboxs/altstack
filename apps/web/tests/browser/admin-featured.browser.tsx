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
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { page } from 'vite-plus/test/browser'

import type { ORPCRouterClient, ORPCRouterOutputs } from '@altstack/api/routers'

import { adminListProjectInputSchema } from '@altstack/shared/schemas/admin-project'
import { adminFeaturedUpdateInputSchema } from '@altstack/shared/schemas/featured'

import { ThemeProvider } from '@altstack/ui/components/customs/theme-provider'

import { FeaturedEditor } from '#/features/admin-featured/components/featured-editor'
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
type Selection = ORPCRouterOutputs['admin']['featured']['list']['projects']
const candidates: Selection = Array.from({ length: 25 }, (_, index) => {
	return {
		id: `550e8400-e29b-41d4-a716-${String(index).padStart(12, '0')}`,
		name:
			index === 0
				? 'Project with a long name that should wrap on narrow screens'
				: `Project ${index + 1}`,
		slug: `project-${index}`,
		logo: null,
		tagline: 'Published project from the catalogue.',
		websiteUrl: `https://project-${index}.example.test`,
		status: 'published',
	}
})
let selection = candidates.slice(0, 24)
const clients: Array<QueryClient> = []
beforeEach(() => {
	selection = candidates.slice(0, 24)
	rpc.mockReset().mockImplementation((path, input) => {
		if (path.join('/') === 'admin/featured/list') {
			return Promise.resolve({ projects: selection })
		}
		if (path.join('/') === 'admin/project/list') {
			return Promise.resolve({
				projects: candidates,
				pagination: {
					page: 1,
					totalItems: 25,
					totalPages: 1,
					hasPreviousPage: false,
					hasNextPage: false,
				},
			})
		}
		if (path.join('/') === 'admin/featured/update') {
			const { body } = adminFeaturedUpdateInputSchema.parse(input)
			selection = body.projectIds.map((id) =>
				candidates.find((p) => p.id === id)!
			)
			return Promise.resolve({ projects: selection })
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
async function mount(theme = 'light') {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	})
	clients.push(client)
	const root = createRootRoute({ component: Outlet })
	const featured = createRoute({
		getParentRoute: () => root,
		path: '/admin/featured',
		component: FeaturedEditor,
	})
	const router = createRouter({
		routeTree: root.addChildren([featured]),
		history: createMemoryHistory({ initialEntries: ['/admin/featured'] }),
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
	await screen.findByRole('list', { name: 'Featured selection' })
	await screen.findByRole('list', { name: 'Published project candidates' })
	await document.fonts.ready
}
function expectPreviewGrid() {
	const preview = screen.getByRole('list', { name: 'Featured layout preview' })
	expect(within(preview).getAllByRole('listitem')).toHaveLength(24)
	expect(getComputedStyle(preview).gridTemplateColumns.split(' ')).toHaveLength(
		6
	)
	const rows = new Set(
		Array.from(preview.children).map((item) =>
			Math.round(item.getBoundingClientRect().top)
		)
	)
	expect(rows.size).toBe(4)
}
describe('admin featured editor in Chromium', () => {
	it('retains the candidate page and keyboard focus until the next page is ready', async () => {
		const original = rpc.getMockImplementation()!
		const { promise: pending, resolve: release } = Promise.withResolvers<void>()
		rpc.mockImplementation((path, input) => {
			if (path.join('/') !== 'admin/project/list') return original(path, input)
			const {
				query: { page: currentPage },
			} = adminListProjectInputSchema.parse(input)
			const result = {
				projects: [candidates[currentPage === 1 ? 0 : 1]],
				pagination: {
					totalItems: 25,
					hasPreviousPage: currentPage > 1,
					hasNextPage: true,
				},
			}
			return currentPage === 1
				? Promise.resolve(result)
				: pending.then(() => result)
		})
		await page.viewport(1280, 900)
		await mount()
		const next = within(
			screen.getByRole('navigation', { name: 'Project search pagination' })
		).getByRole<HTMLButtonElement>('button', { name: 'Next' })
		next.focus()
		fireEvent.click(next)
		try {
			await waitFor(() =>
				expect(
					rpc.mock.calls.some(
						([path, input]) =>
							path.join('/') === 'admin/project/list' &&
							adminListProjectInputSchema.parse(input).query.page === 2
					)
				).toBe(true)
			)
			expect(next.isConnected).toBe(true)
			expect(
				within(
					screen.getByRole('list', { name: 'Published project candidates' })
				).getByText(candidates[0].name)
			).toBeTruthy()
			expect(document.activeElement).toBe(next)
		} finally {
			release()
		}
		await waitFor(() =>
			expect(
				within(
					screen.getByRole('list', { name: 'Published project candidates' })
				).getByText(candidates[1].name)
			).toBeTruthy()
		)
		expect(document.activeElement).toBe(next)
	})
	it.each([320, 768, 1440])(
		'fits the selection, search and 24-slot preview at %ipx in both themes',
		async (width) => {
			await page.viewport(width, 900)
			for (const theme of ['light', 'dark']) {
				await mount(theme)
				expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
				expectPreviewGrid()
				expect(
					screen.getByRole<HTMLButtonElement>('button', {
						name: 'Save changes',
					}).disabled
				).toBe(true)
				expect(
					screen.getByRole<HTMLButtonElement>('button', {
						name: 'Add Project 25 to featured',
					}).disabled
				).toBe(true)
				cleanup()
			}
		}
	)
	it('updates preview order, frees a slot, and saves explicitly', async () => {
		await page.viewport(1440, 900)
		await mount()
		fireEvent.click(screen.getByRole('button', { name: 'Move Project 2 up' }))
		const preview = screen.getByRole('list', {
			name: 'Featured layout preview',
		})
		expect(preview.firstElementChild?.textContent).toContain('1. Project 2')
		fireEvent.click(
			screen.getByRole('button', { name: 'Remove Project 24 from featured' })
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Add Project 25 to featured' })
		)
		expect(
			rpc.mock.calls.some(
				([path]) => path.join('/') === 'admin/featured/update'
			)
		).toBe(false)
		await page.getByRole('button', { name: 'Save changes' }).click()
		await screen.findByText('No unsaved changes')
		expect(selection[0].id).toBe(candidates[1].id)
		expect(selection.at(-1)?.id).toBe(candidates[24].id)
		expect(selection).toHaveLength(24)
	})
	it('confirms reloading and keeps changes when cancelled', async () => {
		await page.viewport(390, 844)
		await mount()
		fireEvent.click(
			screen.getByRole('button', { name: 'Remove Project 24 from featured' })
		)
		await page
			.getByRole('button', { name: 'Discard changes and reload' })
			.click()
		await screen.findByRole('alertdialog', { name: 'Discard unsaved changes?' })
		await waitFor(() =>
			expect(document.activeElement?.textContent).toBe('Keep editing')
		)
		await page.getByRole('button', { name: 'Keep editing' }).click()
		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
		expect(
			screen.queryByRole('button', { name: 'Remove Project 24 from featured' })
		).toBeNull()
		await page
			.getByRole('button', { name: 'Discard changes and reload' })
			.click()
		await page
			.getByRole('button', { name: 'Discard and reload', exact: true })
			.click()
		await screen.findByRole('button', {
			name: 'Remove Project 24 from featured',
		})
	})
})
