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
import { z } from 'zod'

import type { ORPCRouterClient } from '@altstack/api/routers'

import { aboutUpdateSchema, defaultAboutPage } from '@altstack/shared/schemas'

import { ThemeProvider } from '@altstack/ui/components/customs/theme-provider'

import { AboutArticle } from '#/features/about/article'
import { AboutEditor } from '#/features/about/editor'
import '#/styles.css'

const { rpc } = vi.hoisted(() => {
	return {
		rpc: vi.fn<(path: Array<string>, input: unknown) => Promise<unknown>>(),
	}
})
vi.mock('#/utils/orpc', () => {
	return {
		orpc: createTanstackQueryUtils(
			createORPCClient<ORPCRouterClient>({ call: rpc })
		),
	}
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
			VITE_S3_PUBLIC_URL: 'https://storage.test',
		},
	}
})

let queryClient: QueryClient
beforeEach(() => {
	rpc.mockReset().mockImplementation((_path, input) => {
		const { expectedVersion, ...body } = z
			.object({ body: aboutUpdateSchema })
			.parse(input).body
		return Promise.resolve({
			...body,
			version: expectedVersion + 1,
			updatedAt: new Date(),
		})
	})
})
afterEach(() => {
	cleanup()
	queryClient.clear()
	window.scrollTo(0, 0)
})

async function mount(editing: boolean, theme: string) {
	queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	})
	const root = createRootRoute({ component: Outlet })
	const publicRoute = createRoute({
		getParentRoute: () => root,
		path: '/about',
		component: () => <AboutArticle page={defaultAboutPage} />,
	})
	const adminRoute = createRoute({
		getParentRoute: () => root,
		path: '/admin/about',
		component: () => (
			<AboutEditor
				initial={{
					...defaultAboutPage,
					content: '## Our directory\n\nFind useful software.',
				}}
			/>
		),
	})
	const router = createRouter({
		routeTree: root.addChildren([publicRoute, adminRoute]),
		history: createMemoryHistory({
			initialEntries: [editing ? '/admin/about' : '/about'],
		}),
	})
	await router.load()
	render(
		<ThemeProvider attribute="class" forcedTheme={theme}>
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>
		</ThemeProvider>
	)
	await screen.findByRole('heading', { level: 1 })
	await document.fonts.ready
	if (editing) {
		await waitFor(() => {
			if (!document.querySelector('.bn-editor[contenteditable="true"]')) {
				throw new Error('Waiting for the editor')
			}
		})
	}
}

describe('About page in Chromium', () => {
	it.each([
		[390, 'light'],
		[1440, 'dark'],
	] as const)(
		'renders the public article and real editor without overflow at %ipx in %s mode',
		async (width, theme) => {
			await page.viewport(width, 900)
			await mount(false, theme)
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
			await page.screenshot({
				path: `.vitest/attachments/about-public-${width}.png`,
			})
			cleanup()
			queryClient.clear()
			await mount(true, theme)
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
			await page.getByRole('button', { name: 'Preview content' }).click()
			await screen.findByRole('region', { name: 'About preview' })
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
			await page.screenshot({
				path: `.vitest/attachments/about-editor-${width}.png`,
			})
		}
	)
	it('saves actual BlockNote Markdown and supports preview and navigation after saving', async () => {
		await page.viewport(1440, 900)
		await mount(true, 'light')
		const editor = document.querySelector<HTMLElement>(
			'.bn-editor[contenteditable="true"]'
		)!
		editor.focus()
		await userEvent.keyboard(
			'{Control>}{End}{/Control}{Enter}Written with the editor.'
		)
		await page.getByRole('button', { name: 'Save changes' }).click()
		await screen.findByText('About us saved. Your changes are live.')
		const request = z
			.object({ body: aboutUpdateSchema })
			.parse(rpc.mock.calls[0]?.[1])
		expect(request.body.content).toContain('Written with the editor.')
		expect(request.body.expectedVersion).toBe(0)
		await page.getByRole('button', { name: 'Preview content' }).click()
		expect(
			screen.getByRole('region', { name: 'About preview' }).textContent
		).toContain('Written with the editor.')
		await page.getByRole('link', { name: 'View public page' }).click()
		await screen.findByRole('heading', { name: defaultAboutPage.title })
		expect(screen.queryByRole('alertdialog')).toBeNull()
	})
	it.each(['pointer', 'keyboard'] as const)(
		'opens the block style menu for a partial selection with %s and saves the heading',
		async (interaction) => {
			await page.viewport(1440, 900)
			await mount(true, interaction === 'pointer' ? 'light' : 'dark')
			const editor = document.querySelector<HTMLElement>(
				'.bn-editor[contenteditable="true"]'
			)!
			editor.focus()
			await userEvent.keyboard(
				'{Control>}{End}{/Control}{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Shift}'
			)
			expect(window.getSelection()?.toString()).toMatch(/^\w{1,3}\.$/)
			const blockStyle = page.getByRole('toolbar').getByRole('combobox')
			if (interaction === 'pointer') {
				await blockStyle.click()
			} else {
				blockStyle.element().focus()
				await userEvent.keyboard('{ArrowDown}')
			}
			const list = page.getByRole('listbox')
			await expect.element(list).toBeVisible()
			expect(editor.closest('.bn-container')?.contains(list.element())).toBe(
				true
			)
			if (interaction === 'pointer') {
				await page
					.getByRole('option', { name: 'Heading 2', exact: true })
					.click()
			} else {
				await userEvent.keyboard('{Home}{ArrowDown}{ArrowDown}{Enter}')
			}
			await waitFor(() => {
				expect(editor.querySelector('h2')?.textContent).toBe('Our directory')
				expect(editor.querySelectorAll('h2')).toHaveLength(2)
				expect(editor.querySelectorAll('h2')[1]?.textContent).toBe(
					'Find useful software.'
				)
			})
			await page.getByRole('button', { name: 'Save changes' }).click()
			await screen.findByText('About us saved. Your changes are live.')
			const request = z
				.object({ body: aboutUpdateSchema })
				.parse(rpc.mock.calls[0]?.[1])
			expect(request.body.content).toContain('## Find useful software.')
		}
	)
})
