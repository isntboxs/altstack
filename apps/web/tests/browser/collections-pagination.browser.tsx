import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vite-plus/test'
import { page as browserPage } from 'vite-plus/test/browser'

import { CollectionPagination } from '#/features/collections/pagination'
import {
	collectionSearchMiddlewares,
	collectionSearchSchema,
} from '#/features/collections/search'
import '#/styles.css'

afterEach(cleanup)

async function mount(url = '/collections', totalPages = 20) {
	const root = createRootRoute()
	const route = createRoute({
		getParentRoute: () => root,
		path: '/collections',
		validateSearch: collectionSearchSchema,
		search: { middlewares: collectionSearchMiddlewares },
		component: () => {
			const { page } = route.useSearch()
			return (
				<main className="container mx-auto w-full max-w-6xl px-4 lg:px-16">
					<CollectionPagination page={page} totalPages={totalPages} />
				</main>
			)
		},
	})
	const router = createRouter({
		routeTree: root.addChildren([route]),
		history: createMemoryHistory({ initialEntries: [url] }),
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
