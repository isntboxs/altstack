// @vitest-environment jsdom
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from '@tanstack/react-router'
import { act } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import {
	CollectionArticle,
	memberAnchor,
} from '#/features/collections/components'
vi.mock('@altstack/env/web', () => {
	return {
		env: {
			VITE_APP_URL: 'https://altstack.test',
			VITE_S3_PUBLIC_URL: 'https://storage.test',
		},
	}
})
vi.mock('#/features/public-content/server-function', () => {
	return {
		preparePublicContent: vi.fn(),
	}
})
const member = {
	id: '550e8400-e29b-41d4-a716-446655440001',
	name: 'Listed project',
	slug: 'listed-project',
	description: 'Catalogue description',
	content: '## Project documentation\n\n[Read docs](https://example.test/docs)',
	logo: null,
	screenshot: null,
	websiteUrl: null,
	repositoryUrl: 'https://github.com/fixtures/project',
}
const collection: ORPCRouterOutputs['collection']['getBySlug'] = {
	id: '550e8400-e29b-41d4-a716-446655440002',
	name: 'An editorial title',
	slug: 'editorial-list',
	description: 'An editorial description',
	content:
		'## Collection introduction\n\nAdmin-written **Markdown**.\n\n<script>alert(1)</script>',
	kind: 'repository',
	sourceRepositoryUrl: 'https://github.com/fixtures/list',
	authorName: 'The original writer',
	updatedAt: new Date('2026-10-29T00:00:00Z'),
	memberCount: 1,
	mainProject: null,
	projects: [member],
}
beforeEach(() =>
	vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
)
afterEach(() => vi.restoreAllMocks())
describe('collection public SSR', () => {
	it('renders admin copy, source-only lists, safe Markdown and stable member anchors, then hydrates without recoverable errors', async () => {
		const root = createRootRoute({ component: Outlet })
		const route = createRoute({
			getParentRoute: () => root,
			path: '/collections/$slug',
			component: () => <CollectionArticle collection={collection} />,
		})
		const router = createRouter({
			routeTree: root.addChildren([route]),
			history: createMemoryHistory({
				initialEntries: ['/collections/editorial-list'],
			}),
		})
		await router.load()
		const html = renderToString(<RouterProvider router={router} />),
			container = document.createElement('div')
		container.innerHTML = html
		document.body.append(container)
		expect(container.querySelector('h1')?.textContent).toBe(
			'An editorial title'
		)
		expect(container.textContent).toContain('The original writer')
		expect(container.querySelector('time')?.getAttribute('datetime')).toBe(
			'2026-10-29T00:00:00.000Z'
		)
		expect(container.querySelector('strong')?.textContent).toBe('Markdown')
		expect(container.querySelector('script')).toBeNull()
		expect(
			container.querySelector('[data-testid="collection-target"]')
		).toBeNull()
		expect(
			container.querySelector(`a[href="#${memberAnchor(member.id)}"]`)
		).not.toBeNull()
		expect(
			container.querySelector(`#${memberAnchor(member.id)} h2`)?.textContent
		).toContain(member.name)
		const recoverable = vi.fn()
		let hydrated: ReturnType<typeof hydrateRoot> | undefined
		try {
			await act(async () => {
				hydrated = hydrateRoot(container, <RouterProvider router={router} />, {
					onRecoverableError: recoverable,
				})
				await Promise.resolve()
			})
			expect(recoverable).not.toHaveBeenCalled()
			expect(
				container.querySelector(`#${memberAnchor(member.id)}`)
			).not.toBeNull()
		} finally {
			act(() => hydrated?.unmount())
			container.remove()
		}
	})
})
