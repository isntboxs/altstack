import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { page } from 'vite-plus/test/browser'

import {
	AdBanner,
	AdListingGrid,
	CornerAd,
	SponsorGrid,
} from '#/features/ads/components'
import { AdsContext } from '#/features/ads/context'
import { campaign, now } from '../ads-fixtures'
import '#/styles.css'
vi.mock('#/components/project-media', () => {
	return {
		ProjectLogo: ({ className }: { className: string }) => (
			<span className={className} aria-hidden="true">
				A
			</span>
		),
	}
})
vi.mock('#/utils/storage', () => {
	return {
		resolveFileUrl: () =>
			'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
	}
})
afterEach(() => {
	cleanup()
	sessionStorage.clear()
})
const ads = Array.from({ length: 6 }, (_, i) => {
	return {
		...campaign(`fixture-${i}`),
		name: `Fixture advertiser ${i}`,
		description:
			'A synthetic description that stays readable across catalogue layouts and mobile devices.',
	}
})
function mount() {
	render(
		<AdsContext
			value={{
				campaigns: ads,
				now,
				entry: '/',
				selections: {
					banner: { ids: [ads[0].id], selectedAt: now },
					listing: { ids: ads.slice(0, 3).map((ad) => ad.id), selectedAt: now },
				},
			}}
		>
			<header className="fixed top-0 h-12">Header</header>
			<AdBanner />
			<main className="mx-auto max-w-6xl px-4 pt-28">
				<SponsorGrid />
				<AdListingGrid
					items={Array.from({ length: 45 }, (_, i) => {
						return { id: String(i) }
					})}
					catalogue="layout"
					page={1}
					offset={0}
					renderItem={(item) => (
						<article className="min-h-56 rounded-xl border p-4" data-organic>
							{item.id}
						</article>
					)}
				/>
			</main>
			<footer>End of catalogue</footer>
			<CornerAd />
		</AdsContext>
	)
}
describe('ad responsive layout', () => {
	it.each([390, 800, 1280])(
		'keeps exact listing positions and no horizontal overflow at %i pixels',
		async (width) => {
			await page.viewport(width, 900)
			mount()
			await waitFor(() =>
				expect(document.querySelectorAll('[data-ad-id]')).toHaveLength(3)
			)
			const grid = document.querySelector('[data-ad-id]')!.parentElement!
			const positions = Array.from(grid.children).flatMap((child, i) =>
				child.hasAttribute('data-ad-id') ? [i + 1] : []
			)
			expect(positions).toEqual(width < 768 ? [3, 15, 29] : [3, 18, 33])
			expect(document.querySelectorAll('[data-organic]')).toHaveLength(42)
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
			const banner = document.querySelector('.ad-banner')!
			const headerBottom = document
				.querySelector('header')!
				.getBoundingClientRect().bottom
			expect(banner.getBoundingClientRect().top).toBeGreaterThanOrEqual(
				headerBottom
			)
			expect(
				banner.getBoundingClientRect().top - headerBottom
			).toBeLessThanOrEqual(16)
			expect(getComputedStyle(banner).position).not.toBe('sticky')
			const sponsorGrid = document.querySelector('.ad-sponsors .grid')!
			expect(
				getComputedStyle(sponsorGrid).gridTemplateColumns.split(' ')
			).toHaveLength(width < 640 ? 2 : width < 1024 ? 3 : 6)
			await waitFor(() =>
				expect(document.querySelector('.ad-corner')).toBeTruthy()
			)
			const corner = document.querySelector<HTMLElement>('.ad-corner')!
			expect(corner.getBoundingClientRect().right).toBeLessThanOrEqual(width)
			const hide = corner.querySelector<HTMLButtonElement>(
				'[aria-label="Hide ads for this session"]'
			)!
			expect(hide.getBoundingClientRect().width).toBeGreaterThanOrEqual(24)
			expect(hide.getBoundingClientRect().height).toBeGreaterThanOrEqual(24)
			hide.focus()
			expect(getComputedStyle(hide.parentElement!).opacity).toBe('1')
			fireEvent.click(hide)
			expect(document.querySelector('.ad-corner')).toBeNull()
		}
	)
	it('backfills all 45 organic items after cosmetic blocking without retrying ads', async () => {
		await page.viewport(1280, 900)
		mount()
		await waitFor(() =>
			expect(document.querySelectorAll('[data-ad-id]')).toHaveLength(3)
		)
		for (const element of document.querySelectorAll<HTMLElement>(
			'[data-ad-id]'
		)) {
			element.style.display = 'none'
		}
		await waitFor(() =>
			expect(document.querySelectorAll('[data-organic]')).toHaveLength(45)
		)
		expect(document.querySelectorAll('[data-ad-id]')).toHaveLength(0)
	})
})
