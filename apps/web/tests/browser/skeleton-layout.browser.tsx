import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { page } from 'vite-plus/test/browser'

import { CategoryComboboxView } from '#/components/category-combobox-view'
import { ProjectListSection } from '#/components/project-list-section'
import { ProjectResultsSkeleton } from '#/components/public-skeletons'
import { CategoryComboboxSkeleton } from '#/components/workspace-skeletons'
import { homeProjectPageLink } from '#/features/project/page-links'
import '#/styles.css'

vi.mock('@altstack/env/web', () => {
	return {
		env: { VITE_S3_PUBLIC_URL: 'https://storage.test' },
	}
})
afterEach(cleanup)

async function mount(children: ReactNode) {
	const root = createRootRoute({ component: () => children })
	const router = createRouter({
		routeTree: root,
		history: createMemoryHistory({ initialEntries: ['/'] }),
	})
	await router.load()
	render(<RouterProvider router={router} />)
	await document.fonts.ready
}

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
const pagination = {
	page: 1,
	limit: 12,
	totalItems: 12,
	totalPages: 1,
	hasPreviousPage: false,
	hasNextPage: false,
}

// Compare browser geometry of the real components, including fonts and responsive
// CSS. A snapshot of skeleton classes would not catch changes to the loaded UI.
describe('skeleton geometry in Chromium', () => {
	it.each([1440, 768, 390])(
		'matches the loaded results grid at %ipx',
		async (width) => {
			await page.viewport(width, 900)
			await mount(
				<>
					<div data-testid="loaded">
						<ProjectListSection
							data={{ projects, pagination }}
							emptyMessage="No projects"
							pageLinkOptions={homeProjectPageLink}
						/>
					</div>
					<div data-testid="pending">
						<ProjectResultsSkeleton />
					</div>
				</>
			)
			const liveSection = document.querySelector(
				'[data-testid="loaded"] section'
			)!
			const pendingSection = document.querySelector(
				'[data-testid="pending"] section'
			)!
			const live = [...liveSection.querySelectorAll('[data-slot="card"]')]
			const pending = [...pendingSection.querySelectorAll('[data-slot="card"]')]
			expect(pending).toHaveLength(live.length)
			for (const [index, element] of live.entries()) {
				const actual = element.getBoundingClientRect()
				const placeholder = pending[index].getBoundingClientRect()
				for (const metric of ['width', 'height', 'x'] as const) {
					expect(Math.abs(actual[metric] - placeholder[metric])).toBeLessThan(1)
				}
				expect(
					Math.abs(
						actual.y -
							liveSection.getBoundingClientRect().y -
							(placeholder.y - pendingSection.getBoundingClientRect().y)
					)
				).toBeLessThan(1)
			}
			expect(
				pendingSection.querySelector('output')!.getBoundingClientRect().height
			).toBe(1)
		}
	)

	it.each([
		{ viewport: 1440, form: 736 },
		{ viewport: 768, form: 470 },
		{ viewport: 390, form: 348 },
	])(
		'reserves the category control and wrapping help at $viewport px',
		async ({ viewport, form }) => {
			await page.viewport(viewport, 900)

			await mount(
				<>
					<div style={{ width: form }}>
						<div data-testid="loaded">
							<CategoryComboboxView
								categories={[
									{
										id: 'backend',
										slug: 'backend',
										name: 'Backend',
										description: 'Backend projects.',
										path: 'backend',
										parentId: null,
										depth: 1,
										isLeaf: true,
										projectCount: 0,
										directProjectCount: 0,
									},
								]}
								id="categories"
								value={['backend']}
								onValueChange={() => undefined}
							/>
						</div>
						<div data-testid="pending">
							<CategoryComboboxSkeleton />
						</div>
					</div>
				</>
			)
			await waitFor(() =>
				expect(
					document.querySelector('[data-slot="combobox-chips"]')
				).not.toBeNull()
			)
			const actual = document
				.querySelector('[data-testid="loaded"]')!
				.getBoundingClientRect()
			const placeholder = document
				.querySelector('[data-testid="pending"]')!
				.getBoundingClientRect()
			expect(Math.abs(actual.height - placeholder.height)).toBeLessThan(1)
			expect(actual.width).toBe(placeholder.width)
		}
	)
})
