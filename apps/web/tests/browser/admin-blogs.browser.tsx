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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { page, userEvent } from 'vite-plus/test/browser'

import type { ORPCRouterClient } from '@altstack/api/routers'

import { ThemeProvider } from '@altstack/ui/components/customs/theme-provider'

import { BlogEditor } from '#/features/admin-blogs/editor'
import '#/styles.css'

const { rpc } = vi.hoisted(() => {
	return {
		rpc: vi.fn<(path: Array<string>, input: unknown) => Promise<unknown>>(),
	}
})
vi.mock('#/utils/orpc', () => {
	const client = createORPCClient<ORPCRouterClient>({ call: rpc })
	return { client, orpc: createTanstackQueryUtils(client) }
})
vi.mock('#/components/block-note/project-mention-menu', () => {
	return {
		ProjectMentionMenus: () => null,
	}
})
vi.mock('#/features/public-content/server-function', () => {
	return {
		preparePublicContent: vi.fn(),
		preparePublicBlogContent: vi.fn(),
	}
})
vi.mock('@altstack/env/web', () => {
	return {
		env: {
			VITE_APP_URL: 'https://altstack.test',
			VITE_S3_PUBLIC_URL: 'https://images.test',
		},
	}
})
let client: QueryClient
beforeEach(() => {
	rpc.mockReset().mockResolvedValue({})
})
afterEach(() => {
	cleanup()
	client.clear()
	window.scrollTo(0, 0)
})

async function mount(theme = 'light') {
	client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	})
	const root = createRootRoute({ component: Outlet })
	const create = createRoute({
		getParentRoute: () => root,
		path: '/admin/blogs/create',
		component: BlogEditor,
	})
	const list = createRoute({
		getParentRoute: () => root,
		path: '/admin/blogs',
		component: () => <p>Blog directory</p>,
	})
	const router = createRouter({
		routeTree: root.addChildren([create, list]),
		history: createMemoryHistory({ initialEntries: ['/admin/blogs/create'] }),
	})
	await router.load()
	render(
		<ThemeProvider attribute="class" forcedTheme={theme}>
			<QueryClientProvider client={client}>
				<RouterProvider router={router} />
			</QueryClientProvider>
		</ThemeProvider>
	)
	await screen.findByRole('heading', { name: 'Create blog post' })
	await waitFor(() =>
		expect(
			document.querySelector('.bn-editor[contenteditable="true"]')
		).not.toBeNull()
	)
	await document.fonts.ready
}

describe('admin blog authoring in Chromium', () => {
	it.each([
		[390, 'light'],
		[768, 'dark'],
		[1440, 'light'],
	] as const)(
		'renders the real editor and both cover sources at %ipx in %s mode',
		async (width, theme) => {
			await page.viewport(width, 900)
			await mount(theme)
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
			expect(screen.getByRole('button', { name: 'Select File' })).not.toBeNull()
			await page
				.getByLabelText('Title', { exact: true })
				.fill('Shipping useful software')
			expect(screen.getByLabelText<HTMLInputElement>('Slug').value).toBe(
				'shipping-useful-software'
			)
			await page.getByRole('tab', { name: 'Image URL' }).click()
			await page
				.getByLabelText('Cover image URL')
				.fill('https://images.test/cover.webp')
			expect(
				screen.getByRole<HTMLImageElement>('img', {
					name: 'Blog cover preview',
				}).src
			).toBe('https://images.test/cover.webp')
			await page.getByRole('tab', { name: 'Upload image' }).click()
			expect(
				screen.getByRole<HTMLImageElement>('img', { name: 'cover preview' }).src
			).toBe('https://images.test/cover.webp')
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
		}
	)
	it('saves the real Markdown editor contents and an external cover URL', async () => {
		await page.viewport(1440, 900)
		await mount()
		await page.getByLabelText('Title', { exact: true }).fill('A tech article')
		await page
			.getByLabelText('Description', { exact: true })
			.fill('Ideas for building software.')
		await page.getByRole('tab', { name: 'Image URL' }).click()
		await page
			.getByLabelText('Cover image URL')
			.fill('https://images.test/cover.webp')
		const editor = document.querySelector<HTMLElement>(
			'.bn-editor[contenteditable="true"]'
		)!
		editor.focus()
		await userEvent.keyboard('Writing with the shared editor.')
		await page.getByRole('button', { name: 'Save draft' }).click()
		await screen.findByText('Blog directory')
		const call = rpc.mock.calls.find(
			([path]) => path.join('/') === 'admin/blog/create'
		)
		expect(call?.[1]).toMatchObject({
			body: {
				title: 'A tech article',
				slug: 'a-tech-article',
				description: 'Ideas for building software.',
				coverUrl: 'https://images.test/cover.webp',
				content: 'Writing with the shared editor.',
				status: 'draft',
			},
		})
	})
})
