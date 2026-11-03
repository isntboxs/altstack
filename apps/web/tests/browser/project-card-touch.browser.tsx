import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vite-plus/test'
import { cdp, page } from 'vite-plus/test/browser'

import { projectCardPreviewSchema } from '@altstack/shared/schemas/project'

import { ProjectCard } from '#/components/project-list-section'
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
afterEach(cleanup)

// Chromium can retain altered hover behavior after touch emulation is disabled.
// A separate test file keeps its browser page isolated from mouse interaction tests.
it('keeps the touch detail action below the License row without hover', async () => {
	const session = cdp()
	await session.send('Emulation.setTouchEmulationEnabled', {
		enabled: true,
		maxTouchPoints: 1,
	})
	try {
		await page.viewport(390, 900)
		const project = projectCardPreviewSchema.parse({
			id: '00000000-0000-4000-8000-000000000001',
			name: 'Touch project',
			slug: 'touch-project',
			logo: '',
			tagline: 'An open source project.',
			description: 'The full project description.',
			github: {
				owner: 'fixtures',
				repo: 'touch-project',
				stars: 10,
				forks: 1,
				fetchedAt: new Date(),
			},
		})
		const root = createRootRoute({
			component: () => (
				<div className="w-96 max-w-full p-4">
					<ProjectCard {...project} />
				</div>
			),
		})
		const router = createRouter({
			routeTree: root,
			history: createMemoryHistory({ initialEntries: ['/'] }),
		})
		await router.load()
		render(<RouterProvider router={router} />)
		expect(window.matchMedia('(pointer: coarse)').matches).toBe(true)
		const summary = document.querySelector(
			'[data-slot="project-card-summary"]'
		)!
		const licenseRow = summary.lastElementChild!.lastElementChild!
		const details = document.querySelector(
			'[data-slot="project-card-description"] + a'
		)!
		await expect.element(page.elementLocator(summary)).toBeVisible()
		await expect.element(page.elementLocator(details)).toBeVisible()
		expect(licenseRow.textContent).toContain('License')
		expect(licenseRow.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			details.getBoundingClientRect().top - 16
		)
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
	} finally {
		await session.send('Emulation.setTouchEmulationEnabled', { enabled: false })
	}
})
