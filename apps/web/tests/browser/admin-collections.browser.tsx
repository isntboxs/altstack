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

import { ThemeProvider } from '@altstack/ui/components/customs/theme-provider'

import { CollectionEditor } from '#/features/admin-collections/editor'
import { Route as ListRoute } from '#/routes/_main/admin.collections/index'
import '#/styles.css'

const { rpc } = vi.hoisted(() => {
	return {
		rpc: vi.fn<(path: Array<string>, input: unknown) => Promise<unknown>>(),
	}
})
vi.mock('#/utils/orpc', () => {
	const client = createORPCClient<ORPCRouterClient>({ call: rpc })
	const orpc = createTanstackQueryUtils(client)
	return {
		client,
		orpc,
		adminORPC: orpc.admin,
		projectORPC: orpc.project,
		categoryORPC: orpc.category,
	}
})
vi.mock('#/components/public-content', () => {
	return {
		PublicContent: ({ content }: { content: string }) => (
			<article>{content}</article>
		),
	}
})
vi.mock('#/components/block-note/project-mention-menu', () => {
	return { ProjectMentionMenus: () => null }
})
vi.mock('@altstack/env/web', () => {
	return {
		env: {
			VITE_S3_PUBLIC_URL: 'https://storage.test',
			VITE_APP_URL: 'https://altstack.test',
		},
	}
})
const first = {
	id: '550e8400-e29b-41d4-a716-446655440001',
	name: 'First project with a long name for responsive layouts',
	slug: 'first',
	description: 'A published project in the catalogue.',
	logo: null,
	screenshot: null,
	content: 'Project content',
	websiteUrl: null,
	repositoryUrl: 'https://github.com/test/first',
	status: 'published',
}
const second = {
	...first,
	id: '550e8400-e29b-41d4-a716-446655440002',
	name: 'Second project',
	slug: 'second',
}
const initial: ORPCRouterOutputs['admin']['collection']['getById'] = {
	id: '550e8400-e29b-41d4-a716-446655440003',
	name: 'A collection of useful community projects',
	slug: 'community-projects',
	description: 'A collection description explaining what readers will find.',
	content: 'An introduction to these projects.',
	kind: 'repository',
	sourceRepositoryUrl: 'https://github.com/test/list',
	mainProjectId: null,
	mainProject: null,
	status: 'draft',
	version: 1,
	updatedAt: new Date('2026-10-29T00:00:00Z'),
	authorName: 'Collection author',
	projects: [first],
}
const clients: Array<QueryClient> = []
beforeEach(() => {
	rpc.mockReset().mockImplementation((path) => {
		if (path.join('/') === 'admin/project/list') {
			return Promise.resolve({
				projects: [first, second],
				pagination: { hasPreviousPage: false, hasNextPage: false },
			})
		}
		if (path.join('/') === 'admin/collection/list') {
			return Promise.resolve({
				collections: [
					initial,
					{
						...initial,
						id: second.id,
						name: 'Published collection',
						status: 'published',
					},
				],
				total: 2,
			})
		}
		return Promise.resolve(initial)
	})
})
afterEach(() => {
	cleanup()
	for (const client of clients) client.clear()
	clients.length = 0
	document.documentElement.classList.remove('dark')
	window.scrollTo(0, 0)
})
async function mount(mode: 'list' | 'create' | 'edit', theme = 'light') {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	})
	clients.push(client)
	const root = createRootRoute({ component: Outlet })
	const list = createRoute({
		getParentRoute: () => root,
		path: '/admin/collections',
		component: ListRoute.options.component,
	})
	const create = createRoute({
		getParentRoute: () => root,
		path: '/admin/collections/create',
		component: () => <CollectionEditor />,
	})
	const edit = createRoute({
		getParentRoute: () => root,
		path: '/admin/collections/$id/edit',
		component: () => <CollectionEditor initial={initial} />,
	})
	const router = createRouter({
		routeTree: root.addChildren([list, create, edit]),
		history: createMemoryHistory({
			initialEntries: [
				mode === 'list'
					? '/admin/collections'
					: mode === 'create'
						? '/admin/collections/create'
						: `/admin/collections/${initial.id}/edit`,
			],
		}),
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
	await screen.findByRole('heading', {
		name:
			mode === 'list'
				? 'Collections'
				: mode === 'create'
					? 'Create collection'
					: 'Edit collection',
	})
	if (mode !== 'list') {
		await screen.findAllByRole('button', { name: 'Add member' })
		await waitFor(expectEditorReady)
	}
	await document.fonts.ready
	return router
}
function expectNoOverflow(width: number) {
	expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
}

function expectEditorReady() {
	expect(
		document.querySelector(
			'.bn-editor [contenteditable="true"], .bn-editor[contenteditable="true"]'
		)
	).not.toBeNull()
}

function expectPublicationLayout(width: number) {
	const sidebar = screen
		.getByRole('complementary', { name: 'Collection publication' })
		.getBoundingClientRect()
	const details = screen.getByLabelText('Title').getBoundingClientRect()
	expect(
		width >= 1024 ? sidebar.left > details.right : sidebar.top > details.bottom
	).toBe(true)
}

describe('admin collection layouts', () => {
	it('keeps candidate rows, pagination and keyboard focus while loading the next page', async () => {
		const original = rpc.getMockImplementation()!
		const { promise: pending, resolve: release } = Promise.withResolvers<void>()
		rpc.mockImplementation((path, input) => {
			if (path.join('/') !== 'admin/project/list') return original(path, input)
			const {
				query: { page: currentPage },
			} = adminListProjectInputSchema.parse(input)
			const result = {
				projects: [currentPage === 1 ? first : second],
				pagination: { hasPreviousPage: currentPage > 1, hasNextPage: true },
			}
			return currentPage === 1
				? Promise.resolve(result)
				: pending.then(() => result)
		})
		await page.viewport(1280, 900)
		await mount('create')
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
					screen.getByRole('list', { name: 'Available projects' })
				).getByText(first.name)
			).toBeTruthy()
			expect(document.activeElement).toBe(next)
		} finally {
			release()
		}
		await waitFor(() =>
			expect(
				within(
					screen.getByRole('list', { name: 'Available projects' })
				).getByText(second.name)
			).toBeTruthy()
		)
		expect(document.activeElement).toBe(next)
	})
	it.each([320, 768, 1440])(
		'keeps list, create, and edit usable at %ipx in both themes',
		async (width) => {
			await page.viewport(width, 900)
			for (const theme of ['light', 'dark']) {
				for (const mode of ['list', 'create', 'edit'] as const) {
					await mount(mode, theme)
					expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
						width
					)
					if (mode !== 'list') {
						await screen.findByText(
							mode === 'edit'
								? 'No unsaved changes'
								: 'Your collection starts as a draft'
						)
						expectPublicationLayout(width)
						fireEvent.click(
							screen.getByRole('button', { name: 'Show public preview' })
						)
						expectNoOverflow(width)
					}
					cleanup()
				}
			}
		}
	)
	it('confirms deletes and keeps keyboard focus in the dialog', async () => {
		await page.viewport(390, 844)
		await mount('list')
		await page
			.getByRole('button', { name: `Delete ${initial.name}`, exact: true })
			.click()
		await screen.findByRole('alertdialog', { name: 'Delete collection?' })
		await waitFor(() =>
			expect(document.activeElement?.textContent).toBe('Keep collection')
		)
		expectNoOverflow(390)
		await page.getByRole('button', { name: 'Keep collection' }).click()
		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
		expect(
			rpc.mock.calls.some(
				([path]) => path.join('/') === 'admin/collection/delete'
			)
		).toBe(false)
	})
	it('adds, reorders, and removes projects, then protects unsaved edits', async () => {
		await page.viewport(1440, 900)
		await mount('edit')
		const selector = screen.getByRole('region', { name: 'Project selector' })
		fireEvent.click(
			within(selector).getByRole('button', { name: 'Add member' })
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Move Second project up' })
		)
		const members = screen.getByRole('region', { name: /Members/ })
		expect(within(members).getAllByRole('listitem')[0].textContent).toContain(
			'Second project'
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Remove Second project' })
		)
		fireEvent.change(screen.getByLabelText('Title'), {
			target: { value: 'Unsaved collection title' },
		})
		await page.getByRole('link', { name: 'Cancel', exact: true }).click()
		await screen.findByRole('alertdialog', { name: 'Leave without saving?' })
		await page.getByRole('button', { name: 'Keep editing' }).click()
		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
		expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe(
			'Unsaved collection title'
		)
	})
})
