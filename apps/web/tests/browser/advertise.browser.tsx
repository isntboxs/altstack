import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { page } from 'vite-plus/test/browser'

import { AdvertisePage } from '#/features/ads/advertise-page'
import '#/styles.css'

vi.mock('@tanstack/react-router', () => {
	return {
		Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
			<a href={to} {...props}>
				{children}
			</a>
		),
	}
})
vi.mock('#/utils/orpc', () => {
	return {
		client: { adBilling: { create: vi.fn(), requestAccess: vi.fn() } },
		orpc: {
			adBilling: {
				config: {
					queryOptions: () => {
						return {
							queryKey: ['ad-config'],
							queryFn: () =>
								Promise.resolve({
									available: true,
									contactEmail: 'team@example.test',
								}),
						}
					},
				},
			},
		},
	}
})
const clients: Array<QueryClient> = []
async function mount() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	clients.push(client)
	render(
		<QueryClientProvider client={client}>
			<AdvertisePage />
		</QueryClientProvider>
	)
	await document.fonts.ready
	await waitFor(() =>
		expect(
			document.querySelector<HTMLButtonElement>('[data-package-cards] button')!
				.disabled
		).toBe(false)
	)
}
afterEach(() => {
	cleanup()
	clients.splice(0).forEach((client) => client.clear())
	document.documentElement.classList.remove('dark')
})

describe('advertise responsive layout', () => {
	it.each([320, 390, 768, 1280])(
		'keeps packages usable and contains horizontal scrolling at %i px',
		async (width) => {
			await page.viewport(width, 900)
			if (width < 640) document.documentElement.classList.add('dark')
			await mount()
			const rail = document.querySelector<HTMLElement>('[data-package-cards]')!
			const cards = Array.from(
				rail.querySelectorAll<HTMLElement>('[data-slot=card]')
			)
			expect(cards).toHaveLength(3)
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
			expect(cards[0].getBoundingClientRect().width).toBeGreaterThanOrEqual(
				Math.min(256, width * 0.65)
			)
			expect(rail.scrollWidth > rail.clientWidth).toBe(width < 1024)
			rail.scrollLeft = rail.scrollWidth
			await waitFor(() => expect(rail.scrollLeft > 0).toBe(width < 1024))
			const bottoms = cards.map(
				(card) => card.querySelector('button')!.getBoundingClientRect().bottom
			)
			expect(
				width < 1024 || Math.max(...bottoms) - Math.min(...bottoms) < 2
			).toBe(true)
			const figures = Array.from(
				document.querySelectorAll<HTMLElement>('figure')
			)
			expect(figures).toHaveLength(4)
			const first = figures[0].getBoundingClientRect(),
				second = figures[1].getBoundingClientRect()
			expect(
				width >= 640 ||
					(second.left === first.left && second.top > first.bottom)
			).toBe(true)
		}
	)
	it('opens the selected package, returns focus on close and expands the FAQ', async () => {
		await page.viewport(1280, 900)
		await mount()
		await page.getByRole('button', { name: 'Choose Plus', exact: true }).click()
		await expect.element(page.getByRole('dialog')).toBeVisible()
		await expect
			.element(page.getByRole('heading', { name: 'Advertise with Plus' }))
			.toBeVisible()
		await page.getByRole('button', { name: 'Close', exact: true }).click()
		await waitFor(() =>
			expect(document.querySelector('[role=dialog]')).toBeNull()
		)
		expect(document.activeElement?.textContent).toBe('Choose Plus')
		await page
			.getByRole('button', { name: 'How do payment and renewal work?' })
			.click()
		await expect
			.element(
				page.getByText(
					/No account, card on file, or automatic renewal is required/
				)
			)
			.toBeVisible()
	})
})
