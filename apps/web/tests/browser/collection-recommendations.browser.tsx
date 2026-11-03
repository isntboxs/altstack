import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { page } from 'vite-plus/test/browser'

import type { ProjectCardPreview } from '@altstack/shared/schemas/project'

import { ProjectCollectionRecommendations } from '#/features/project/components/collection-recommendations'
import '#/styles.css'

vi.mock('@altstack/env/web', () => {
	return { env: { VITE_S3_PUBLIC_URL: 'https://storage.test' } }
})
vi.mock('#/features/project/queries', () => {
	return { projectQueries: {}, projectCatalogueKey: () => '' }
})
vi.mock('#/features/ads/components', () => {
	return { AdListingGrid: () => null }
})
afterEach(() => {
	cleanup()
	document.documentElement.classList.remove('dark')
})

const projects: Array<ProjectCardPreview> = Array.from(
	{ length: 3 },
	(_, index) => {
		return {
			id: `00000000-0000-4000-8000-00000000000${index}`,
			slug: `collection-peer-${index}`,
			name: `Collection peer ${index}`,
			verified: false,
			logo: '',
			tagline: 'Tools for open source teams.',
			description: 'A project that belongs to this editorial collection.',
			github: {
				owner: 'fixtures',
				repo: `peer-${index}`,
				stars: 10,
				forks: 2,
				fetchedAt: new Date(),
				lastCommitAt: null,
				metadataFetchedAt: null,
				licenseKey: null,
				licenseName: null,
				licenseSpdxId: null,
				licenseSlug: null,
				licenseUrl: null,
				archived: null,
			},
		}
	}
)
const collections = [
	{
		id: '00000000-0000-4000-8000-000000000010',
		name: 'Open source web crawling and scraping tools for developers building reliable data collection pipelines',
		slug: 'web-crawling',
		projects,
	},
]

async function mount(groups = collections) {
	const root = createRootRoute()
	const home = createRoute({
		getParentRoute: () => root,
		path: '/',
		component: () => (
			<>
				<main className="mx-auto w-full max-w-6xl p-4">
					<p>Project content</p>
					<ProjectCollectionRecommendations
						collections={groups}
						now={Date.now()}
					/>
				</main>
				<footer>Footer</footer>
			</>
		),
	})
	const collection = createRoute({
		getParentRoute: () => root,
		path: 'collections/$slug',
		component: () => <h1>Collection detail</h1>,
	})
	const router = createRouter({
		routeTree: root.addChildren([home, collection]),
		history: createMemoryHistory({ initialEntries: ['/'] }),
	})
	await router.load()
	render(<RouterProvider router={router} />)
	return router
}

describe('project collection recommendations', () => {
	it.each([
		{ width: 320, columns: 1 },
		{ width: 768, columns: 2 },
		{ width: 1020, columns: 2 },
		{ width: 1280, columns: 3 },
	])(
		'fits long collection names at $width px and keeps links usable',
		async ({ width, columns }) => {
			await page.viewport(width, 1000)
			const router = await mount()
			const section = screen.getByRole('region', {
				name: 'Similar open source projects',
			})
			const cards = [...section.querySelectorAll('[data-slot="project-card"]')]
			expect(cards).toHaveLength(3)
			expect(section.querySelectorAll('h3')).toHaveLength(3)
			for (const theme of ['light', 'dark']) {
				document.documentElement.classList.toggle('dark', theme === 'dark')
				expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
				expect(
					getComputedStyle(cards[0].parentElement!).gridTemplateColumns.split(
						' '
					)
				).toHaveLength(columns)
				const heading = section.querySelector('h2')!
				expect(heading.getBoundingClientRect().width).toBeGreaterThan(150)
				expect(heading.getBoundingClientRect().height).toBeLessThanOrEqual(
					parseFloat(getComputedStyle(heading).lineHeight) * 2
				)
				expect(
					section
						.querySelector('[data-slot="separator"]')!
						.getBoundingClientRect().width
				).toBe(width >= 640 ? 64 : 0)
			}
			const link = page.getByRole('link', {
				name: `View collection: ${collections[0].name}`,
			})
			await expect.element(link).toBeVisible()
			await link.click()
			expect(router.state.location.pathname).toBe('/collections/web-crawling')
		}
	)
	it('renders no section for projects without related collections', async () => {
		await mount([])
		expect(
			screen.queryByRole('heading', { name: 'Similar open source projects' })
		).toBeNull()
		expect(document.querySelector('[data-slot="project-card"]')).toBeNull()
	})
})
