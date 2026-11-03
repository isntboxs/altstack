import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router'
import {
	act,
	cleanup,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { page, userEvent } from 'vite-plus/test/browser'

import { HomeFilterSection } from '#/features/project/components/home-filters'
import { ProjectFilterPanel } from '#/features/project/components/project-filter-panel'
import { homeProjectSearchSchema } from '#/features/project/search'
import { stringifyProjectSearch } from '#/features/project/search-serialization'
import '#/styles.css'

const fixtures = vi.hoisted(() => {
	return {
		categories: [
			{
				slug: 'accounting-software',
				name: 'Accounting Software',
				projectCount: 9,
			},
			{
				slug: 'agile-project-management',
				name: 'Agile Project Management',
				projectCount: 7,
			},
			{
				slug: 'ai-agent-platforms',
				name: 'AI Agent Platforms',
				projectCount: 34,
			},
			...Array.from({ length: 20 }, (_, index) => {
				return {
					slug: `tools-${index}`,
					name: `Tools ${index}`,
					projectCount: index + 1,
				}
			}),
		],
		licenses: [
			{
				slug: 'mit',
				name: 'MIT License',
				identifier: 'MIT',
				projectCount: 222,
			},
			{
				slug: 'agpl-3.0',
				name: 'GNU Affero General Public License v3.0',
				identifier: 'AGPL-3.0',
				projectCount: 120,
			},
			{
				slug: 'apache-2.0',
				name: 'Apache License 2.0',
				identifier: 'Apache-2.0',
				projectCount: 185,
			},
		],
	}
})
vi.mock('#/features/category/queries', () => {
	return {
		categoryQueries: {
			list: () => {
				return {
					queryKey: ['filter-categories'],
					queryFn: () => Promise.resolve({ categories: fixtures.categories }),
				}
			},
		},
	}
})
vi.mock('#/features/license/queries', () => {
	return {
		licenseQueries: {
			list: () => {
				return {
					queryKey: ['filter-licenses'],
					queryFn: () => Promise.resolve({ licenses: fixtures.licenses }),
				}
			},
		},
	}
})

afterEach(() => {
	cleanup()
	document.documentElement.classList.remove('dark')
})

async function mount(url = '/') {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, staleTime: Infinity } },
	})
	const root = createRootRoute()
	const layout = createRoute({ getParentRoute: () => root, id: '_app' })
	const home = createRoute({
		getParentRoute: () => layout,
		path: '/',
		validateSearch: homeProjectSearchSchema,
		component: HomeFilterSection,
	})
	const router = createRouter({
		routeTree: root.addChildren([layout.addChildren([home])]),
		history: createMemoryHistory({ initialEntries: [url] }),
		stringifySearch: stringifyProjectSearch,
	})
	await router.load()
	render(
		<QueryClientProvider client={client}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	)
	return { router, client }
}

function contrastRatio(element: Element, pseudo?: string) {
	const canvas = document.createElement('canvas')
	canvas.width = canvas.height = 1
	const context = canvas.getContext('2d')!
	context.fillStyle = 'white'
	context.fillRect(0, 0, 1, 1)
	const ancestors: Array<Element> = []
	for (let node: Element | null = element; node; node = node.parentElement) {
		ancestors.unshift(node)
	}
	for (const node of ancestors) {
		context.fillStyle = getComputedStyle(node).backgroundColor
		context.fillRect(0, 0, 1, 1)
	}
	const luminance = () =>
		Array.from(context.getImageData(0, 0, 1, 1).data)
			.slice(0, 3)
			.map((channel) => {
				const value = channel / 255
				return value <= 0.04045
					? value / 12.92
					: ((value + 0.055) / 1.055) ** 2.4
			})
			.reduce(
				(sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
				0
			)
	const background = luminance()
	context.fillStyle = getComputedStyle(element, pseudo).color
	context.fillRect(0, 0, 1, 1)
	const foreground = luminance()
	return (
		(Math.max(foreground, background) + 0.05) /
		(Math.min(foreground, background) + 0.05)
	)
}

describe('home category and license filters', () => {
	it('supports keyboard selection and a visible focus indicator', async () => {
		await page.viewport(1024, 900)
		const { router } = await mount('/?category=accounting-software')
		const search = await screen.findByRole('textbox', {
			name: 'Search category',
		})
		search.focus()
		await userEvent.keyboard('{Tab}')
		const checkbox = screen.getByRole('checkbox', {
			name: 'Accounting Software',
		})
		expect(document.activeElement).toBe(checkbox)
		expect(getComputedStyle(checkbox.closest('label')!).boxShadow).not.toBe(
			'none'
		)
		await userEvent.keyboard(' ')
		await waitFor(() =>
			expect(router.state.location.search.category).toBeUndefined()
		)
	})

	it('provides loading, empty, failure and retry states', async () => {
		const retry = vi.fn()
		const props = {
			label: 'Category',
			options: [],
			selected: [],
			onToggle: vi.fn(),
			onRetry: retry,
			isPending: true,
			isError: false,
		}
		const { rerender } = render(<ProjectFilterPanel {...props} />)
		expect(screen.getByText('Loading category filters…')).toBeTruthy()
		rerender(<ProjectFilterPanel {...props} isPending={false} isError />)
		expect(screen.getByRole('alert').textContent).toContain(
			'Unable to load category filters'
		)
		await page.getByRole('button', { name: 'Try again' }).click()
		expect(retry).toHaveBeenCalledOnce()
		rerender(<ProjectFilterPanel {...props} isPending={false} />)
		expect(screen.getByRole('status').textContent).toContain(
			'No options available yet'
		)
	})

	it('searches lists, selects multiple facets, removes chips and clears only selections', async () => {
		await page.viewport(1024, 900)
		const { router } = await mount('/?q=agent&sort=most-stars&page=2')
		await page.getByRole('button', { name: 'Filter' }).click()
		const category = within(
			await screen.findByRole('group', { name: 'Category' })
		)
		expect(category.getAllByText('9')[0]).toBeTruthy()
		await page
			.getByRole('textbox', { name: 'Search category' })
			.fill('ai agent')
		expect(
			category.queryByRole('checkbox', { name: 'Accounting Software' })
		).toBeNull()
		await page.getByRole('checkbox', { name: 'AI Agent Platforms' }).click()
		await page.getByRole('textbox', { name: 'Search category' }).fill('')
		await page.getByRole('checkbox', { name: 'Accounting Software' }).click()
		await page
			.getByRole('checkbox', { name: 'Agile Project Management' })
			.click()
		await page.getByRole('checkbox', { name: 'MIT' }).click()
		await page.getByRole('checkbox', { name: 'AGPL-3.0' }).click()
		await page.getByRole('checkbox', { name: 'Apache-2.0' }).click()
		await waitFor(() =>
			expect(router.state.location.search).toMatchObject({
				category:
					'ai-agent-platforms,accounting-software,agile-project-management',
				license: 'mit,agpl-3.0,apache-2.0',
				q: 'agent',
				sort: 'most-stars',
			})
		)
		expect(router.state.location.search.page).toBeUndefined()
		expect(router.state.location.searchStr).toContain(
			'license=mit,agpl-3.0,apache-2.0'
		)
		expect(
			within(
				screen.getByRole('group', { name: 'Selected category filters' })
			).getAllByRole('button')
		).toHaveLength(3)
		await page
			.getByRole('button', {
				name: 'Remove category: Accounting Software',
			})
			.click()
		await waitFor(() =>
			expect(router.state.location.search.category).toBe(
				'ai-agent-platforms,agile-project-management'
			)
		)
		await page.getByRole('checkbox', { name: 'AGPL-3.0' }).click()
		await waitFor(() =>
			expect(router.state.location.search.license).toBe('mit,apache-2.0')
		)
		await page.getByRole('button', { name: 'Filter' }).click()
		await waitFor(() =>
			expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull()
		)
		await page.getByRole('button', { name: 'Filter' }).click()
		await page.getByRole('button', { name: 'Clear all' }).click()
		await waitFor(() =>
			expect(router.state.location.search).toEqual({
				q: 'agent',
				sort: 'most-stars',
			})
		)
		await page.getByRole('button', { name: 'Reset' }).click()
		await waitFor(() => expect(router.state.location.search).toEqual({}))
	})

	it.each([320, 390, 1024])(
		'restores URL selections and fits a %ipx viewport in both themes',
		async (width) => {
			await page.viewport(width, 900)
			const { router } = await mount(
				'/?category=accounting-software,agile-project-management&license=mit,apache-2.0'
			)
			await screen.findByRole('button', {
				name: 'Remove category: Accounting Software',
			})
			expect(
				screen.getByRole('checkbox', {
					name: 'Accounting Software',
				})
			).toHaveAttribute('aria-checked', 'true')
			expect(screen.getByRole('checkbox', { name: 'MIT' })).toHaveAttribute(
				'aria-checked',
				'true'
			)
			for (const theme of ['light', 'dark']) {
				document.documentElement.classList.toggle('dark', theme === 'dark')
				await waitFor(() =>
					expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
						width
					)
				)
				const categories = screen.getByRole('group', {
					name: 'Category',
				})
				const licenses = screen.getByRole('group', {
					name: 'License',
				})
				const a = categories.getBoundingClientRect()
				const b = licenses.getBoundingClientRect()
				expect(width < 640 ? b.top > a.top : b.top === a.top).toBe(true)
				const scroll = categories.querySelector('.overflow-y-auto')!
				expect(scroll.scrollHeight).toBeGreaterThan(scroll.clientHeight)
				for (const element of [
					categories.querySelector('label span')!,
					categories.querySelector('[data-slot="badge"]')!,
					screen.getByRole('button', {
						name: 'Remove category: Accounting Software',
					}),
				]) {
					expect(contrastRatio(element)).toBeGreaterThanOrEqual(4.5)
				}
				expect(
					contrastRatio(
						screen.getByRole('textbox', { name: 'Search category' }),
						'::placeholder'
					)
				).toBeGreaterThanOrEqual(4.5)
			}
			await page
				.getByRole('textbox', { name: 'Search license' })
				.fill('not-found')
			expect(screen.getByRole('status').textContent).toContain(
				'No matching options'
			)
			await page.getByRole('textbox', { name: 'Search license' }).fill('apache')
			expect(screen.queryByRole('checkbox', { name: 'MIT' })).toBeNull()
			expect(screen.getByRole('checkbox', { name: 'Apache-2.0' })).toBeTruthy()
			await act(() =>
				router.navigate({ to: '/', search: { category: 'ai-agent-platforms' } })
			)
			await waitFor(() =>
				expect(
					screen.getByRole('checkbox', {
						name: 'AI Agent Platforms',
					})
				).toHaveAttribute('aria-checked', 'true')
			)
			act(() => router.history.back())
			await waitFor(() =>
				expect(router.state.location.search.license).toBe('mit,apache-2.0')
			)
		}
	)
})
