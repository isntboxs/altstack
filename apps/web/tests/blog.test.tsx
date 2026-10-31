// @vitest-environment jsdom
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router'
import { act } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { BlogArticle, BlogCards } from '#/features/blogs/components'
import { articleHeadings } from '#/features/public-content/headings'
import { emptyPublicContent } from '#/features/public-content/model'

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
	it('uses shared highlighted code blocks, project mentions and internal blog links', async () => {
		const prepared = emptyPublicContent()
		prepared.codeBlocks[0] = {
			code: 'const x = 1',
			language: 'js',
			tokens: [
				[
					{
						content: 'const x = 1',
						light: { color: '#123456' },
						dark: { color: '#abcdef' },
					},
				],
			],
		}
		prepared.projectsBySlug.vite = {
			slug: 'vite',
			name: 'Vite',
			logo: null,
			tagline: null,
			stars: 0,
			forks: 0,
		}
		const data = {
			...post,
			content:
				'```js\nconst x = 1\n```\n\n## Intro\n\nBuilt with [a tool](/vite). [Next](next-post). [Website](https://example.test).',
		}
		const root = createRootRoute({
			component: () => <BlogArticle post={data} prepared={prepared} />,
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
		expect(
			container
				.querySelector('[data-code-block] button')
				?.getAttribute('aria-label')
		).toBe('Copy code')
		expect(
			container.querySelector('.public-code-token')?.getAttribute('style')
		).toContain('#123456')
		expect(
			container.querySelector('[data-project-mention="vite"]')?.textContent
		).toContain('Vite')
		expect(container.querySelector('a[href="/blogs/next-post"]')).not.toBeNull()
		expect(container.querySelector('h2#intro-0')?.textContent).toBe('Intro')
		expect(
			container
				.querySelector('a[href="https://example.test"]')
				?.getAttribute('target')
		).toBe('_blank')
	})
	it('extracts formatted, repeated, setext, and Unicode headings without treating fenced code as sections', () => {
		expect(
			articleHeadings(
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
	it('renders permalinks for every content heading without nesting existing Markdown links', async () => {
		const data = {
			...post,
			content:
				'# Intro\n\n## **Read [the guide](https://example.test)**\n\n### Use `tools`\n\n#### Details\n\n##### Details\n\n###### 日本語',
		}
		const root = createRootRoute()
		const route = createRoute({
			getParentRoute: () => root,
			path: '/blogs/$slug',
			component: () => <BlogArticle post={data} />,
		})
		const router = createRouter({
			routeTree: root.addChildren([route]),
			history: createMemoryHistory({
				initialEntries: ['/blogs/building-software'],
			}),
		})
		await router.load()
		const container = document.createElement('div')
		container.innerHTML = renderToString(<RouterProvider router={router} />)
		const content = container.querySelector(
			'article[aria-label="Article content"]'
		)!
		const headings = content.querySelectorAll('h2, h3, h4, h5, h6')
		expect(headings).toHaveLength(6)
		for (const heading of headings) {
			const link = heading.querySelector('a[aria-label^="Link to "]')!
			expect(link).not.toBeNull()
			const target = new URL(
				link.getAttribute('href')!,
				'https://altstack.test'
			)
			expect(target.pathname).toBe('/blogs/building-software')
			expect(decodeURIComponent(target.hash.slice(1))).toBe(heading.id)
			const textLink = heading.querySelector('a:not([aria-label])')!
			expect(textLink).not.toBeNull()
			expect(textLink.textContent.trim()).not.toBe('')
			expect(textLink.getAttribute('href')).toBe(link.getAttribute('href'))
		}
		expect(content.querySelector('a a')).toBeNull()
		expect(content.querySelector('strong')?.textContent).toContain(
			'Read the guide'
		)
		expect(content.querySelector('code')?.textContent).toBe('tools')
		expect(
			content.querySelector('a[href="https://example.test"]')
		).not.toBeNull()
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
		expect(container.innerHTML).toContain(post.title)
		expect(container.querySelectorAll('h1')).toHaveLength(1)
		expect(container.textContent).toContain('Alex Morgan')
		expect(container.textContent).not.toContain('Published:')
		expect(container.querySelectorAll('header time')).toHaveLength(1)
		expect(container.textContent).toContain('Updated: October 2, 2026')
		expect(container.textContent).toContain('2 min read')
		expect(container.querySelector('img')?.getAttribute('src')).toBe(
			post.coverUrl
		)
		expect(container.querySelector('script')).toBeNull()
		expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
		for (const heading of articleHeadings(post.content)) {
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

	it('shows the publication date alone when the article has not been updated', async () => {
		const root = createRootRoute({
			component: () => (
				<BlogArticle post={{ ...post, updatedAt: post.publishedAt }} />
			),
		})
		const router = createRouter({
			routeTree: root,
			history: createMemoryHistory(),
		})
		await router.load()
		const container = document.createElement('div')
		container.innerHTML = renderToString(<RouterProvider router={router} />)
		expect(container.textContent).toContain('Published: October 1, 2026')
		expect(container.textContent).not.toContain('Updated:')
		expect(container.querySelectorAll('header time')).toHaveLength(1)
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

vi.mock('#/features/public-content/server-function', () => {
	return {
		preparePublicContent: vi.fn(),
		preparePublicBlogContent: vi.fn(),
	}
})
