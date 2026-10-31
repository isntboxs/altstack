// @vitest-environment jsdom
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router'
import { act } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { BlogArticle, BlogCards } from '#/features/blogs/components'
import { blogHeadings } from '#/features/blogs/markdown'

vi.mock('@altstack/env/web', () => {
	return {
		env: {
			VITE_APP_URL: 'https://altstack.test',
			VITE_S3_PUBLIC_URL: 'https://storage.test',
		},
	}
})

const post: ORPCRouterOutputs['blog']['getBySlug'] = {
	id: 'post',
	slug: 'building-software',
	title: 'Building software',
	description: 'A practical tech article.',
	coverUrl: 'https://images.example.test/cover.webp',
	content:
		'## Start **small**\n\nSafe Markdown.\n\n### Use `tools`\n\n[Bad link](javascript:alert(1))\n\n<script>alert(1)</script>\n\n## Start **small**\n\nMore text.',
	readTime: 2,
	authorName: 'Alex Morgan',
	authorImage: null,
	publishedAt: new Date('2026-10-01T00:00:00Z'),
	updatedAt: new Date('2026-10-02T00:00:00Z'),
}
beforeEach(() =>
	vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
)
afterEach(() => vi.restoreAllMocks())
describe('blog article HTML and anchors', () => {
	it('extracts formatted, repeated, setext, and Unicode headings without treating fenced code as sections', () => {
		expect(
			blogHeadings(
				'## Start **small**\n\n### Use `tools`\n\n## Start **small**\n\n```md\n## Not a heading\n```\n\nÜber café\n----------\n\n## 日本語'
			)
		).toEqual([
			{ id: 'start-small-0', title: 'Start small', depth: 2 },
			{ id: 'use-tools-1', title: 'Use tools', depth: 3 },
			{ id: 'start-small-2', title: 'Start small', depth: 2 },
			{ id: 'uber-cafe-3', title: 'Über café', depth: 2 },
			{ id: '日本語-4', title: '日本語', depth: 2 },
		])
	})
	it('server-renders safe Markdown, byline, cover, dates, matching TOC IDs and sharing, then hydrates cleanly', async () => {
		const root = createRootRoute({
			component: () => <BlogArticle post={post} />,
		})
		const router = createRouter({
			routeTree: root,
			history: createMemoryHistory({
				initialEntries: ['/blogs/building-software'],
			}),
		})
		await router.load()
		const container = document.createElement('div')
		container.innerHTML = renderToString(<RouterProvider router={router} />)
		document.body.append(container)
		expect(container.querySelectorAll('h1')).toHaveLength(1)
		expect(container.textContent).toContain('Alex Morgan')
		expect(container.textContent).toContain('Published: October 1, 2026')
		expect(container.textContent).toContain('Updated: October 2, 2026')
		expect(container.textContent).toContain('2 min read')
		expect(container.querySelector('img')?.getAttribute('src')).toBe(
			post.coverUrl
		)
		expect(container.querySelector('script')).toBeNull()
		expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
		for (const heading of blogHeadings(post.content)) {
			expect(container.querySelector(`a[href="#${heading.id}"]`)).not.toBeNull()
			expect(container.querySelector(`[id="${heading.id}"]`)?.textContent).toBe(
				heading.title
			)
		}
		expect(container.textContent).toContain('Copy Link')
		const onRecoverableError = vi.fn()
		let hydrated: ReturnType<typeof hydrateRoot> | undefined
		await act(async () => {
			hydrated = hydrateRoot(container, <RouterProvider router={router} />, {
				onRecoverableError,
			})
			await Promise.resolve()
		})
		expect(onRecoverableError).not.toHaveBeenCalled()
		await act(async () => {
			hydrated?.unmount()
			await Promise.resolve()
		})
		container.remove()
	})
	it('renders public cards with cover, title, description, publication date and read time', async () => {
		const root = createRootRoute({
			component: () => <BlogCards posts={[post]} />,
		})
		const router = createRouter({
			routeTree: root,
			history: createMemoryHistory(),
		})
		await router.load()
		const html = renderToString(<RouterProvider router={router} />)
		expect(html).toContain('/blogs/building-software')
		expect(html).toContain('A practical tech article.')
		expect(html).toContain('October 1, 2026')
		expect(html).toContain('2')
		expect(html).toContain('min read')
	})
})
