import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { page } from 'vite-plus/test/browser'

import { ProjectSidebar } from '#/features/project/components/featured-projects'
import type { FeaturedProjectsData } from '#/features/project/components/featured-projects'
import '#/styles.css'

vi.mock('@altstack/env/web', () => {
	return {
		env: { VITE_S3_PUBLIC_URL: 'https://storage.test' },
	}
})
afterEach(() => {
	cleanup()
	window.scrollTo(0, 0)
})

const projects: FeaturedProjectsData = Array.from(
	{ length: 21 },
	(_, index) => {
		return {
			id: `featured-${index}`,
			name: `Featured ${index}`,
			verified: false,
			slug: `featured-${index}`,
			logo: null,
			tagline: `Useful open-source project ${index}`,
			websiteUrl: `https://featured-${index}.example.test/`,
			stars: 1234,
			forks: 56,
		}
	}
)
const statistics = {
	github: {
		licenseKey: null,
		licenseName: null,
		licenseSpdxId: null,
		licenseSlug: null,
		licenseUrl: null,
		archived: null,
		owner: 'test',
		repo: 'source',
		stars: 321,
		forks: 5,
		fetchedAt: new Date(),
		metadataFetchedAt: null,
		lastCommitAt: null,
		repositoryCreatedAt: null,
		latestReleaseTag: null,
	},
	history: {
		timezone: 'Asia/Jakarta' as const,
		windowStartDate: '2026-09-22',
		windowEndDate: '2026-10-22',
		points: [],
		comparison: null,
	},
	now: Date.now(),
}
async function mount(selection = projects) {
	const root = createRootRoute({
		component: () => (
			<>
				<header
					style={{
						position: 'fixed',
						top: 0,
						height: 48,
						width: '100%',
						zIndex: 50,
					}}
				>
					Header
				</header>
				<section className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 pt-22 pb-10 md:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
					<article>
						<div style={{ height: 2400 }}>Project content</div>
						<div data-testid="share">Copy link / Share buttons</div>
					</article>
					<ProjectSidebar projects={selection} {...statistics} />
				</section>
				<footer style={{ height: 900 }}>Footer</footer>
			</>
		),
	})
	const router = createRouter({
		routeTree: root,
		history: createMemoryHistory({ initialEntries: ['/'] }),
	})
	await router.load()
	render(<RouterProvider router={router} />)
	await document.fonts.ready
	await waitFor(() =>
		expect(
			document.querySelector('[aria-label="Project sidebar"]')
		).not.toBeNull()
	)
}

describe('featured project layout and interaction in Chromium', () => {
	it.each([1440, 768])(
		'scrolls stats away before featured sticks, and stops before the footer at %ipx',
		async (width) => {
			await page.viewport(width, 900)
			await mount()
			const panel = document.querySelector('[data-featured-panel]')!
			const stats = document.querySelector(
				'[aria-label="Project sidebar"] [data-slot="card"]'
			)!
			expect(panel.getBoundingClientRect().top).toBeGreaterThan(
				stats.getBoundingClientRect().bottom
			)
			window.scrollTo(0, 1000)
			await waitFor(() =>
				expect(Math.abs(panel.getBoundingClientRect().top - 68)).toBeLessThan(1)
			)
			expect(stats.getBoundingClientRect().bottom).toBeLessThan(68)
			window.scrollTo(0, document.documentElement.scrollHeight)
			await waitFor(() =>
				expect(panel.getBoundingClientRect().bottom).toBeLessThanOrEqual(
					document.querySelector('footer')!.getBoundingClientRect().top
				)
			)
		}
	)
	it.each([390, 320])(
		'places featured below share and before stats without sticky or page overflow at %ipx',
		async (width) => {
			await page.viewport(width, 844)
			await mount()
			const panel = document.querySelector('[data-featured-panel]')!
			const share = document.querySelector('[data-testid="share"]')!
			const stats = document.querySelector(
				'[aria-label="Project sidebar"] [data-slot="card"]'
			)!
			expect(panel.getBoundingClientRect().top).toBeGreaterThan(
				share.getBoundingClientRect().bottom
			)
			expect(stats.getBoundingClientRect().top).toBeGreaterThan(
				panel.getBoundingClientRect().bottom
			)
			expect(getComputedStyle(panel).position).toBe('static')
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
			const logo = document.querySelector(
				'[aria-label="Featured project websites"] a'
			)!
			expect(logo.getBoundingClientRect().width).toBeGreaterThanOrEqual(44)
		}
	)
	it('shows the existing mention preview while the icon remains a direct external website link', async () => {
		await page.viewport(1440, 900)
		await mount(projects.slice(0, 2))
		const trigger = page.getByRole('link', {
			name: 'Visit Featured 0 website (opens in a new tab)',
		})
		await trigger.hover()
		await expect
			.element(page.getByLabelText('Featured 0 preview'))
			.toBeVisible()
		await expect
			.element(page.getByText('Useful open-source project 0'))
			.toBeVisible()
		const anchor = document.querySelector(
			'[aria-label="Featured project websites"] a'
		)!
		expect(anchor.getAttribute('href')).toBe('https://featured-0.example.test/')
		expect(anchor.getAttribute('target')).toBe('_blank')
		expect(anchor.getAttribute('rel')).toBe('noopener noreferrer')
		expect(
			document
				.querySelector('[aria-label="Featured 0 preview"] a')
				?.getAttribute('href')
		).toBe('/featured-0')
		expect(document.querySelector('a a')).toBeNull()
	})
	it('keeps the stats sticky when the featured selection is empty', async () => {
		await page.viewport(1440, 900)
		await mount([])
		expect(document.querySelector('[data-featured-panel]')).toBeNull()
		window.scrollTo(0, 1000)
		await waitFor(() =>
			expect(
				Math.abs(
					document
						.querySelector('[aria-label="Project sidebar"] [data-slot="card"]')!
						.getBoundingClientRect().top - 68
				)
			).toBeLessThan(1)
		)
	})
})
