import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { page } from 'vite-plus/test/browser'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import {
	CollectionArticle,
	memberAnchor,
} from '#/features/collections/components'
import '#/styles.css'
vi.mock('@altstack/env/web', () => {
	return {
		env: {
			VITE_S3_PUBLIC_URL: 'https://storage.test',
			VITE_APP_URL: 'https://altstack.test',
		},
	}
})
vi.mock('#/components/public-content', () => {
	return {
		PublicContent: ({ content }: { content: string }) => (
			<div style={{ height: 650 }}>
				{content}
				<a href="https://example.test">Documentation link</a>
			</div>
		),
	}
})

type Collection = ORPCRouterOutputs['collection']['getBySlug']
const projects = Array.from({ length: 35 }, (_, index) => {
	return {
		id: `project-${index}`,
		name: `Project ${index}`,
		slug: `member-${index}`,
		description: 'Description from the project catalogue.',
		logo: null,
		screenshot: null,
		content: 'Markdown content from the project.',
		websiteUrl: null,
		repositoryUrl: 'https://github.com/fixtures/project',
	}
})
const collection: Collection = {
	id: 'collection',
	name: 'Tools for development',
	slug: 'development-tools',
	description: 'An admin-written introduction.',
	content: 'Admin-written Markdown.',
	kind: 'ecosystem',
	sourceRepositoryUrl: null,
	authorName: 'Editorial author',
	updatedAt: new Date('2026-10-29T00:00:00Z'),
	memberCount: 35,
	mainProject: { ...projects[0], id: 'target', name: 'Main tool' },
	projects,
}
afterEach(() => {
	cleanup()
	window.scrollTo(0, 0)
})
async function mount(data = collection) {
	const root = createRootRoute({
		component: () => (
			<>
				<header style={{ position: 'fixed', top: 0, height: 48, zIndex: 50 }}>
					Global navigation
				</header>
				<CollectionArticle collection={data} />
				<section data-testid="below" style={{ height: 1000 }}>
					More collections
				</section>
				<footer style={{ height: 600 }}>Footer</footer>
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
			document.querySelector('[data-testid="collection-article-region"]')
		).not.toBeNull()
	)
}
const section = (index: number) =>
	document.getElementById(memberAnchor(projects[index].id))!
function expectActiveProject(index: number) {
	const active = document.querySelectorAll(
		'nav[aria-label="Collection projects"] [aria-current="location"]'
	)
	expect(active).toHaveLength(1)
	expect(active[0].getAttribute('href')).toBe(
		`#${memberAnchor(projects[index].id)}`
	)
	expect(getComputedStyle(active[0]).backgroundColor).not.toBe(
		'rgba(0, 0, 0, 0)'
	)
}
describe('collection sticky article in Chromium', () => {
	it('aligns navigation with the first member, sticks section headers without stacking, and stops nav/share before more collections', async () => {
		await page.viewport(1440, 900)
		await mount()
		const nav = document.querySelector('nav[aria-label="Collection projects"]')!
		const share = document.querySelector(
			'article[aria-label="Collection projects"] > .sticky'
		)!
		expect(
			Math.abs(
				nav.getBoundingClientRect().top - section(0).getBoundingClientRect().top
			)
		).toBeLessThan(2)
		const firstHeading = section(0).querySelector('h2')!
		window.scrollTo(
			0,
			section(0).getBoundingClientRect().top + window.scrollY + 130
		)
		await waitFor(() =>
			expect(
				Math.abs(firstHeading.getBoundingClientRect().top - 48)
			).toBeLessThan(1)
		)
		expect(Math.abs(nav.getBoundingClientRect().top - 64)).toBeLessThan(1)
		expect(share.getBoundingClientRect().bottom).toBeLessThanOrEqual(900)
		window.scrollTo(
			0,
			section(1).getBoundingClientRect().top + window.scrollY + 120
		)
		await waitFor(() =>
			expect(
				Math.abs(
					section(1).querySelector('h2')!.getBoundingClientRect().top - 48
				)
			).toBeLessThan(1)
		)
		expect(firstHeading.getBoundingClientRect().bottom).toBeLessThan(48)
		const below = document.querySelector('[data-testid="below"]')!
		window.scrollTo(0, below.getBoundingClientRect().top + window.scrollY - 100)
		await waitFor(() =>
			expect(nav.getBoundingClientRect().bottom).toBeLessThanOrEqual(
				below.getBoundingClientRect().top
			)
		)
		expect(share.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			below.getBoundingClientRect().top
		)
	})
	it('keeps an internally scrollable nav, follows deep active sections without moving the page, and aligns clicked anchors', async () => {
		await page.viewport(1440, 700)
		await mount()
		expectActiveProject(0)
		const list = document.querySelector(
			'nav[aria-label="Collection projects"] ol'
		)!
		expect(list.scrollHeight).toBeGreaterThan(list.clientHeight)
		const target = section(28).getBoundingClientRect().top + window.scrollY - 48
		window.scrollTo(0, target)
		await waitFor(() => expectActiveProject(28))
		expect(Math.abs(window.scrollY - target)).toBeLessThan(2)
		const active = document.querySelector('nav [aria-current="location"]')!
		await waitFor(() => {
			expect(active.getBoundingClientRect().top).toBeGreaterThanOrEqual(
				list.getBoundingClientRect().top - 1
			)
			expect(active.getBoundingClientRect().bottom).toBeLessThanOrEqual(
				list.getBoundingClientRect().bottom + 1
			)
		})
		const anchor = document.querySelector<HTMLAnchorElement>(
			`nav a[href="#${memberAnchor(projects[27].id)}"]`
		)!
		anchor.click()
		await waitFor(() => expectActiveProject(27))
		await waitFor(() =>
			expect(
				Math.abs(section(27).getBoundingClientRect().top - 48)
			).toBeLessThan(2)
		)
		expect(document.activeElement?.id).toBe(
			`${memberAnchor(projects[27].id)}-title`
		)
		window.scrollTo(
			0,
			section(5).getBoundingClientRect().top + window.scrollY - 48
		)
		await waitFor(() => expectActiveProject(5))
	})
	it.each([390, 320])(
		'hides target/navigation and keeps share and clipped previews inside the viewport at %ipx',
		async (width) => {
			await page.viewport(width, 844)
			await mount()
			expect(
				getComputedStyle(
					document.querySelector('[data-testid="collection-target"]')!
				).display
			).toBe('none')
			expect(
				getComputedStyle(
					document.querySelector('[data-testid="collection-navigation"]')!
				).display
			).toBe('none')
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
			const preview = document.querySelector(
				'[data-testid="collection-content-preview"]'
			)!
			expect(preview.getBoundingClientRect().height).toBeLessThanOrEqual(384)
			expect(preview.querySelector('[inert]')).not.toBeNull()
			window.scrollTo(
				0,
				section(2).getBoundingClientRect().top + window.scrollY + 120
			)
			await waitFor(() =>
				expect(
					Math.abs(
						section(2).querySelector('h2')!.getBoundingClientRect().top - 48
					)
				).toBeLessThan(1)
			)
			expect(
				document
					.querySelector('article[aria-label="Collection projects"] > .sticky')!
					.getBoundingClientRect().bottom
			).toBeLessThanOrEqual(844)
		}
	)
	it('does not render a target card for repository collections', async () => {
		await page.viewport(1440, 900)
		await mount({
			...collection,
			kind: 'repository',
			mainProject: null,
			sourceRepositoryUrl: 'https://github.com/fixtures/list',
		})
		expect(
			document.querySelector('[data-testid="collection-target"]')
		).toBeNull()
		expect(
			document.querySelector('a[href="https://github.com/fixtures/list"]')
		).not.toBeNull()
	})
})
