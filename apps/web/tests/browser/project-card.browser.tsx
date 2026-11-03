import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { page, userEvent } from 'vite-plus/test/browser'

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

const projects = Array.from({ length: 12 }, (_, index) => {
	return {
		id: `project-${index}`,
		slug: `project-${index}`,
		verified: false,
		name: `Project ${index}`,
		logo: '',
		screenshot: null,
		repositoryUrl: `https://github.com/test/project-${index}`,
		websiteUrl: null,
		status: 'published' as const,
		createdAt: new Date(),
		updatedAt: new Date(),
		categories: [],
		tagline: 'Open source software for productive teams.',
		description: 'A project with real rendered content.',
		github: {
			lastCommitAt: null,
			metadataFetchedAt: null,
			licenseKey: null,
			licenseName: null,
			licenseSpdxId: null,
			licenseSlug: null,
			licenseUrl: null,
			archived: null,
			owner: 'test',
			repo: `project-${index}`,
			stars: 1234,
			forks: 99,
			fetchedAt: new Date(),
		},
	}
})
const fullDescription = `${'This project provides a complete collection of tools for planning, building, and maintaining open source applications. '.repeat(15)}End of the full description.`

async function mountProjectCard() {
	const root = createRootRoute()
	const home = createRoute({
		getParentRoute: () => root,
		path: '/',
		component: () => (
			<>
				<p>Outside the card</p>
				<div className="w-96 max-w-full p-4">
					<ProjectCard {...projects[0]} description={fullDescription} />
				</div>
			</>
		),
	})
	const detail = createRoute({
		getParentRoute: () => root,
		path: '$slug',
		component: () => <h1>Project details</h1>,
	})
	const router = createRouter({
		routeTree: root.addChildren([home, detail]),
		history: createMemoryHistory({ initialEntries: ['/'] }),
	})
	await router.load()
	render(<RouterProvider router={router} />)
	await page.getByText('Outside the card').hover()
	return router
}

describe('project card previews', () => {
	it.each([390, 1024])(
		'replaces all stats with the complete description on hover at %ipx without resizing',
		async (width) => {
			await page.viewport(width, 900)
			const router = await mountProjectCard()
			const card = document.querySelector('[data-slot="project-card"]')!
			const summary = card.querySelector('[data-slot="project-card-summary"]')!
			const description = card.querySelector<HTMLElement>(
				'[data-slot="project-card-description"]'
			)!
			const details = page.elementLocator(
				card.querySelector('[data-slot="project-card-description"] + a')!
			)
			const original = card.getBoundingClientRect()
			const surface = card.querySelector('[data-slot="card"]')!
			const stats = summary.lastElementChild!
			expect(
				Math.abs(
					stats.getBoundingClientRect().bottom -
						(surface.getBoundingClientRect().bottom -
							parseFloat(getComputedStyle(surface).paddingBottom))
				)
			).toBeLessThan(1)
			await expect.element(page.elementLocator(summary)).toBeVisible()
			await expect.element(page.elementLocator(description)).not.toBeVisible()
			await expect.element(details).not.toBeVisible()
			await page.elementLocator(card).hover()
			for (const [x, y] of [
				[original.left + 8, original.top + 8],
				[original.right - 8, original.bottom - 8],
				[original.left + 30, original.top + 90],
			]) {
				expect(
					document.elementFromPoint(x, y)?.closest('a')?.getAttribute('href')
				).toBe('/project-0')
			}
			await expect.element(page.elementLocator(summary)).not.toBeVisible()
			await expect.element(page.elementLocator(description)).toBeVisible()
			await expect.element(details).toBeVisible()
			expect(description.textContent).toBe(fullDescription)
			expect(description.scrollHeight).toBeGreaterThan(description.clientHeight)
			description.scrollTop = description.scrollHeight
			expect(description.scrollTop).toBeGreaterThan(0)
			expect(card.getBoundingClientRect().height).toBe(original.height)
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
			await page.getByText('Outside the card').hover()
			await expect.element(page.elementLocator(summary)).toBeVisible()
			await expect.element(details).not.toBeVisible()
			await page.elementLocator(card).hover()
			await details.click()
			await waitFor(() =>
				expect(router.state.location.pathname).toBe('/project-0')
			)
			await expect
				.element(page.getByRole('heading', { name: 'Project details' }))
				.toBeVisible()
		}
	)

	it('exposes the description and detail action when navigating by keyboard', async () => {
		await page.viewport(1024, 900)
		const router = await mountProjectCard()
		await userEvent.keyboard('{Tab}')
		await expect
			.element(page.getByRole('region', { name: 'Project 0 description' }))
			.toBeVisible()
		await expect
			.element(page.getByRole('link', { name: 'View project details' }))
			.toBeVisible()
		await userEvent.keyboard('{Tab}')
		expect(document.activeElement?.getAttribute('aria-label')).toBe(
			'Project 0 description'
		)
		await userEvent.keyboard('{Tab}{Enter}')
		await waitFor(() =>
			expect(router.state.location.pathname).toBe('/project-0')
		)
	})
})
