import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Link,
	Outlet,
	RouterProvider,
} from '@tanstack/react-router'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { page } from 'vite-plus/test/browser'

import { HistoryScrollRestoration } from '#/components/history-scroll-restoration'
import '#/styles.css'

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
	window.scrollTo({ top: 0, behavior: 'instant' })
})

async function scrollTo(top: number) {
	window.scrollTo({ top, behavior: 'instant' })
	await new Promise<void>((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
	})
	expect(window.scrollY).toBe(top)
}

async function mount() {
	const root = createRootRoute({
		component: () => (
			<>
				<HistoryScrollRestoration />
				<nav className="fixed top-0 z-10 flex gap-4 bg-background">
					<Link to="/">Home</Link>
					<Link to="/activity">Open activity</Link>
				</nav>
				<Outlet />
			</>
		),
	})
	const home = createRoute({
		getParentRoute: () => root,
		path: '/',
		component: () => <main style={{ height: 4000 }}>Project catalogue</main>,
	})
	const detail = createRoute({
		getParentRoute: () => root,
		path: '/activity',
		component: () => <main style={{ height: 4000 }}>Project activity</main>,
	})
	const router = createRouter({
		routeTree: root.addChildren([home, detail]),
		history: createMemoryHistory({ initialEntries: ['/'] }),
		scrollRestoration: true,
	})
	await router.load()
	render(<RouterProvider router={router} />)
	await waitFor(() => expect(document.querySelector('main')).not.toBeNull())
	return router
}

describe('browser history scroll restoration', () => {
	it.each([
		{ width: 390, reducedMotion: false },
		{ width: 1440, reducedMotion: false },
		{ width: 390, reducedMotion: true },
	])(
		'restores Back and Forward from the top at $width px, reduced motion: $reducedMotion',
		async ({ width, reducedMotion }) => {
			await page.viewport(width, 900)
			if (reducedMotion) {
				const matchMedia = window.matchMedia.bind(window)
				vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
					const result = matchMedia(query)
					if (query === '(prefers-reduced-motion: reduce)') {
						Object.defineProperty(result, 'matches', { value: true })
					}
					return result
				})
			}
			const router = await mount()
			await scrollTo(1200)
			await page.getByRole('link', { name: 'Open activity' }).click()
			await waitFor(() => {
				expect(router.state.location.pathname).toBe('/activity')
				expect(window.scrollY).toBe(0)
			})
			await scrollTo(1900)
			const scroll = vi.spyOn(window, 'scrollTo')

			for (const [direction, pathname, position] of [
				['back', '/', 1200],
				['forward', '/activity', 1900],
			] as const) {
				const positions = new Set<number>()
				const record = () => positions.add(window.scrollY)
				window.addEventListener('scroll', record)
				scroll.mockClear()
				try {
					act(() => router.history[direction]())
					await waitFor(
						() => {
							expect(router.state.location.pathname).toBe(pathname)
							expect(window.scrollY).toBe(position)
						},
						{ timeout: 3000 }
					)
					expect(scroll).toHaveBeenNthCalledWith(1, {
						top: 0,
						left: 0,
						behavior: 'instant',
					})
					expect(scroll).toHaveBeenLastCalledWith({
						top: position,
						left: 0,
						behavior: reducedMotion ? 'instant' : 'smooth',
					})
					expect(
						[...positions].filter((y) => y > 0 && y < position).length
					).toBeGreaterThanOrEqual(reducedMotion ? 0 : 3)
				} finally {
					window.removeEventListener('scroll', record)
				}
			}

			// A new visit to the same URL gets its own history entry, starting at zero.
			await page.getByRole('link', { name: 'Home', exact: true }).click()
			await waitFor(() => {
				expect(router.state.location.pathname).toBe('/')
				expect(window.scrollY).toBe(0)
			})
		}
	)
})
