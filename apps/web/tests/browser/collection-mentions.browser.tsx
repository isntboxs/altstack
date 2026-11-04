import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { page, userEvent } from 'vite-plus/test/browser'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import BlockNoteEditor from '#/components/block-note/editor'
import type { BlockNoteEditorHandle } from '#/components/block-note/editor'
import { PublicContent } from '#/components/public-content'
import { emptyPublicContent } from '#/features/public-content/model'
import '#/styles.css'

type MentionInput = { query: { q: string } }
const { projects, collections } = vi.hoisted(() => {
	return {
		projects:
			vi.fn<
				(
					input: MentionInput
				) => Promise<ORPCRouterOutputs['project']['mentions']>
			>(),
		collections:
			vi.fn<
				(
					input: MentionInput
				) => Promise<ORPCRouterOutputs['collection']['mentions']>
			>(),
	}
})
vi.mock('#/utils/orpc', () => {
	return {
		projectORPC: {
			mentions: {
				queryOptions: ({ input }: { input: MentionInput }) => {
					return {
						queryKey: ['project-mentions', input],
						queryFn: () => projects(input),
					}
				},
			},
		},
		orpc: {
			collection: {
				mentions: {
					queryOptions: ({ input }: { input: MentionInput }) => {
						return {
							queryKey: ['collection-mentions', input],
							queryFn: () => collections(input),
						}
					},
				},
			},
		},
	}
})
vi.mock('#/features/public-content/server-function', () => {
	return {
		preparePublicContent: vi.fn(),
		preparePublicBlogContent: vi.fn(),
		preparePublicPageContent: vi.fn(),
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
vi.mock('@altstack/ui/components/customs/theme-provider', () => {
	return {
		useTheme: () => {
			return { resolvedTheme: 'light' }
		},
	}
})

const collection = {
	slug: 'frontend-tools',
	name: 'Frontend tools',
	description: 'A collection of tools for building web applications.',
	kind: 'ecosystem' as const,
	logo: null,
	memberCount: 12,
}
const clients: Array<QueryClient> = []
beforeEach(() => {
	projects.mockReset().mockResolvedValue({
		projects: [
			{
				slug: 'frontend',
				name: 'Frontend project',
				tagline: 'A web tool',
				logo: null,
			},
		],
	})
	collections.mockReset().mockResolvedValue({ collections: [collection] })
})
afterEach(() => {
	cleanup()
	clients.splice(0).forEach((client) => client.clear())
	document.documentElement.classList.remove('dark')
})

async function mountEditor() {
	const ref = createRef<BlockNoteEditorHandle>()
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	clients.push(queryClient)
	const view = render(
		<QueryClientProvider client={queryClient}>
			<BlockNoteEditor ref={ref} />
		</QueryClientProvider>
	)
	const editable = await waitFor(() => {
		const element = document.querySelector<HTMLElement>(
			'.bn-editor[contenteditable="true"]'
		)
		expect(element).not.toBeNull()
		return element!
	})
	return { ref, view, editable }
}

describe('collection mentions in Chromium', () => {
	it('searches both groups with @, inserts a collection using the keyboard, and restores the saved badge', async () => {
		await page.viewport(1100, 800)
		const { ref, view, editable } = await mountEditor()
		await userEvent.type(editable, '@front')
		await expect
			.element(page.getByText('Collections', { exact: true }))
			.toBeVisible()
		await expect
			.element(page.getByText('Projects', { exact: true }))
			.toBeVisible()
		await expect
			.element(page.getByText('Frontend tools', { exact: true }))
			.toBeVisible()
		await userEvent.keyboard('{ArrowDown}{Enter}')
		await waitFor(() =>
			expect(
				editable.querySelector('[data-collection-mention="frontend-tools"]')
			).not.toBeNull()
		)
		const markdown = ref.current!.readMarkdown()
		expect(markdown).toContain('[Frontend tools](/collections/frontend-tools)')
		view.unmount()
		const queryClient = new QueryClient()
		clients.push(queryClient)
		render(
			<QueryClientProvider client={queryClient}>
				<BlockNoteEditor value={markdown} />
			</QueryClientProvider>
		)
		await waitFor(() =>
			expect(
				document.querySelector(
					'.bn-editor [data-collection-mention="frontend-tools"]'
				)?.textContent
			).toContain('Frontend tools')
		)
	})

	it('keeps collection results selectable when project search fails and shows the empty state', async () => {
		projects.mockRejectedValue(new Error('Project search offline'))
		const { editable } = await mountEditor()
		await userEvent.type(editable, '@front')
		await page.getByText('Frontend tools', { exact: true }).click()
		await waitFor(() =>
			expect(
				editable.querySelector('[data-collection-mention="frontend-tools"]')
			).not.toBeNull()
		)
		collections.mockResolvedValue({ collections: [] })
		await userEvent.type(editable, ' @nothing')
		await expect
			.element(page.getByText('No projects or collections found'))
			.toBeVisible()
	})

	it.each([false, true])(
		'previews collection badges on hover and focus at mobile width (dark=%s)',
		async (dark) => {
			await page.viewport(375, 812)
			if (dark) document.documentElement.classList.add('dark')
			const prepared = emptyPublicContent()
			prepared.collectionsBySlug[collection.slug] = collection
			const root = createRootRoute({
				component: () => (
					<div className="p-4">
						<PublicContent
							slug="source"
							content="Explore [Frontend tools](/collections/frontend-tools)"
							prepared={prepared}
						/>
					</div>
				),
			})
			const target = createRoute({
				getParentRoute: () => root,
				path: 'collections/$slug',
				component: () => <div>Collection destination</div>,
			})
			const router = createRouter({
				routeTree: root.addChildren([target]),
				history: createMemoryHistory({ initialEntries: ['/'] }),
			})
			await router.load()
			render(<RouterProvider router={router} />)
			const trigger = page.getByRole('link', {
				name: 'Frontend tools',
				exact: true,
			})
			await trigger.hover()
			const details = page.getByRole('link', {
				name: 'View collection details',
			})
			await expect.element(details).toBeVisible()
			const popup = document.querySelector<HTMLElement>(
				'[data-slot="hover-card-content"]'
			)!
			expect(popup.textContent).toContain('12 projects')
			expect(popup.getBoundingClientRect().right).toBeLessThanOrEqual(375)
			expect(popup.getBoundingClientRect().left).toBeGreaterThanOrEqual(0)
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375)
			await trigger.unhover()
			await userEvent.tab()
			await expect.element(trigger).toHaveFocus()
			await expect.element(details).toBeVisible()
			await userEvent.tab()
			await expect.element(details).toHaveFocus()
			await userEvent.keyboard('{Enter}')
			await waitFor(() =>
				expect(router.state.location.pathname).toBe(
					'/collections/frontend-tools'
				)
			)
		}
	)
})
