import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from '@tanstack/react-router'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { page as browserPage } from 'vite-plus/test/browser'

import { HistoryScrollRestoration } from '#/components/history-scroll-restoration'
import { CollectionPagination } from '#/features/collections/pagination'
import {
	collectionSearchMiddlewares,
	collectionSearchSchema,
} from '#/features/collections/search'
import '#/styles.css'

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
	window.scrollTo(0, 0)
})

async function mount(
	url = '/collections',
	totalPages = 20,
	scrollable = false,
	load?: (page: number) => void | Promise<void>
) {
	const root = createRootRoute({
		component: () => (
			<>
				<HistoryScrollRestoration />
				<Outlet />
			</>
		),
	})
	const route = createRoute({
		getParentRoute: () => root,
		path: '/collections',
		validateSearch: collectionSearchSchema,
		search: { middlewares: collectionSearchMiddlewares },
		loaderDeps: ({ search }) => {
			return { page: search.page }
		},
		loader: ({ deps }) => load?.(deps.page),
		pendingMs: 0,
		pendingMinMs: 0,
		pendingComponent: () => (
			<main style={{ height: 3000 }}>Loading collections</main>
		),
		component: () => {
			const { page } = route.useSearch()
			return (
				<main className="container mx-auto w-full max-w-6xl px-4 lg:px-16">
					<div style={{ height: scrollable ? 300 : 0 }} />
					<div
						id="collection-results"
						className="scroll-mt-24"
						style={{ height: scrollable ? 1800 : 0 }}
					/>
					<CollectionPagination page={page} totalPages={totalPages} />
					<div style={{ height: scrollable ? 900 : 0 }} />
				</main>
			)
		},
	})
	const router = createRouter({
		routeTree: root.addChildren([route]),
		history: createMemoryHistory({ initialEntries: [url] }),
		scrollRestoration: true,
	})
	await router.load()
	render(<RouterProvider router={router} />)
	await document.fonts.ready
	await waitFor(() => expect(document.querySelector('main')).not.toBeNull())
	return router
}

const pagination = () =>
	document.querySelector('nav[aria-label="Collections pagination"]')!
const link = (text: string) => {
	const result = Array.from(pagination().querySelectorAll('a')).find(
		(item) => item.textContent.trim() === text
	)
	if (!result) throw new Error(`Missing pagination link: ${text}`)
	return result
}

describe('collections pagination', () => {
	it.each([
		{ width: 320, reducedMotion: true },
		{ width: 1440, reducedMotion: true },
		{ width: 320, reducedMotion: false },
		{ width: 1440, reducedMotion: false },
	])(
		'preserves the outgoing scroll through a pending page, Back and Forward at $width px, reduced motion: $reducedMotion',
		async ({ width, reducedMotion }) => {
			await browserPage.viewport(width, 800)
			const matchMedia = window.matchMedia.bind(window)
			vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
				const result = matchMedia(query)
				if (query === '(prefers-reduced-motion: reduce)') {
					Object.defineProperty(result, 'matches', { value: reducedMotion })
				}
				return result
			})
			const gate = Promise.withResolvers<void>()
			const router = await mount('/collections', 20, true, (page) => {
				if (page === 2) return gate.promise
			})
			const next = browserPage.getByRole('link', { name: 'Next', exact: true })
			await next.hover()
			await new Promise<void>((resolve) => {
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			})
			let clickedFrom = 0
			link('Next').addEventListener(
				'click',
				() => (clickedFrom = window.scrollY),
				{
					once: true,
				}
			)
			await next.click()
			await expect
				.element(browserPage.getByText('Loading collections'))
				.toBeVisible()
			expect(clickedFrom).toBeGreaterThan(500)
			gate.resolve()
			await waitFor(
				() => {
					expect(router.state.location.search.page).toBe(2)
					const target = document.getElementById('collection-results')!
					expect(target).not.toBeNull()
					expect(
						Math.abs(target.getBoundingClientRect().top - 96)
					).toBeLessThan(1)
				},
				{ timeout: 3000 }
			)
			window.scrollTo({ top: 1200, behavior: 'instant' })
			await new Promise<void>((resolve) => {
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			})
			act(() => router.history.back())
			await waitFor(
				() => {
					expect(router.state.location.search.page ?? 1).toBe(1)
					expect(window.scrollY).toBe(clickedFrom)
				},
				{ timeout: 3000 }
			)
			act(() => router.history.forward())
			await waitFor(
				() => {
					expect(router.state.location.search.page).toBe(2)
					expect(window.scrollY).toBe(1200)
				},
				{ timeout: 3000 }
			)
		}
	)
	it.each([320, 1440])(
		'smoothly returns to the first collection below the header at %ipx',
		async (width) => {
			await browserPage.viewport(width, 800)
			const router = await mount('/collections', 20, true)
			const target = document.getElementById('collection-results')!
			for (const [name, expectedPage] of [
				['Next', 2],
				['Prev', 1],
				['2', 2],
			] as const) {
				window.scrollTo(0, 1600)
				await waitFor(() => expect(window.scrollY).toBe(1600))
				const positions = new Set<number>()
				const recordScroll = () => positions.add(window.scrollY)
				window.addEventListener('scroll', recordScroll)
				try {
					await browserPage.getByRole('link', { name, exact: true }).click()
					await waitFor(
						() => {
							expect(router.state.location.search.page ?? 1).toBe(expectedPage)
							expect(
								Math.abs(target.getBoundingClientRect().top - 96)
							).toBeLessThan(1)
						},
						{ timeout: 3000 }
					)
					expect(positions.size).toBeGreaterThan(2)
				} finally {
					window.removeEventListener('scroll', recordScroll)
				}
			}
		}
	)
	it.each([320, 1440])(
		'navigates numbered pages and returns to a clean first-page URL at %ipx',
		async (width) => {
			await browserPage.viewport(width, 800)
			const router = await mount()
			expect(router.state.location.href).toBe('/collections')
			expect(
				pagination().querySelector('[aria-current="page"]')?.textContent
			).toBe('1')
			expect(pagination().querySelector('button')?.disabled).toBe(true)
			expect(link('Next').getAttribute('href')).toBe('/collections?page=2')
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
			link('Next').click()
			await waitFor(() =>
				expect(router.state.location.href).toBe('/collections?page=2')
			)
			expect(
				pagination().querySelector('[aria-current="page"]')?.textContent
			).toBe('2')
			expect(link('Prev').getAttribute('href')).toBe('/collections')
			expect(link('1').getAttribute('href')).toBe('/collections')
			link('1').click()
			await waitFor(() =>
				expect(router.state.location.href).toBe('/collections')
			)
			expect(
				pagination().querySelector('[aria-current="page"]')?.textContent
			).toBe('1')
		}
	)
	it('shows bounded page links with gaps and disables Next on the last page', async () => {
		await browserPage.viewport(320, 800)
		const router = await mount('/collections?page=10')
		expect(
			pagination().querySelector('[aria-current="page"]')?.textContent
		).toBe('10')
		expect(
			Array.from(pagination().querySelectorAll('a')).map((item) =>
				item.textContent.trim()
			)
		).toEqual(['Prev', '1', '9', '10', '11', '20', 'Next'])
		expect(pagination().textContent.match(/…/g)).toHaveLength(2)
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320)
		link('20').click()
		await waitFor(() =>
			expect(router.state.location.href).toBe('/collections?page=20')
		)
		expect(pagination().querySelector('button')?.textContent.trim()).toBe(
			'Next'
		)
		expect(pagination().querySelector('button')?.disabled).toBe(true)
		expect(link('Prev').getAttribute('href')).toBe('/collections?page=19')
	})
	it.each([0, 1])('omits pagination for %i total pages', async (totalPages) => {
		await mount('/collections', totalPages)
		expect(
			document.querySelector('nav[aria-label="Collections pagination"]')
		).toBeNull()
	})
	it.each(['1', '0', 'invalid'])(
		'normalizes page=%s to the first page with clean links',
		async (value) => {
			await mount(`/collections?page=${value}`)
			expect(
				pagination().querySelector('[aria-current="page"]')?.textContent
			).toBe('1')
			expect(link('1').getAttribute('href')).toBe('/collections')
		}
	)
})
