import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	Outlet,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { page, userEvent } from 'vite-plus/test/browser'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { BlogArticle, BlogCards } from '#/features/blogs/components'
import '#/styles.css'

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
	slug: 'technology',
	title: 'How we build software',
	description: 'Ideas and practical guides on technology.',
	coverUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
	content:
		Array.from(
			{ length: 35 },
			(_, i) =>
				`## Section ${i}\n\n${'Building software takes care and practice. '.repeat(50)}\n\n`
		).join('') +
		'\n\n```ts\n' +
		'a'.repeat(250) +
		'\n```\n\n| Feature | Details |\n| --- | --- |\n| Markdown | Tables and code |',
	readTime: 12,
	authorName: 'Alex Morgan',
	authorImage: null,
	publishedAt: new Date('2026-10-01T00:00:00Z'),
	updatedAt: new Date('2026-10-02T00:00:00Z'),
}
afterEach(() => {
	cleanup()
	window.scrollTo(0, 0)
	document.documentElement.classList.remove('dark')
	vi.restoreAllMocks()
})
async function mount(cards = false, data = post, entry = '/blogs/technology') {
	const root = createRootRoute({ component: Outlet })
	const route = createRoute({
		getParentRoute: () => root,
		path: '/blogs/$slug',
		component: () => (
			<>
				<header className="fixed top-0 z-50 h-12 w-full bg-background">
					Global navigation
				</header>
				{cards ? (
					<div className="container mx-auto max-w-6xl px-4 pt-28 lg:px-16">
						<BlogCards
							posts={[
								post,
								{ ...post, id: 'second' },
								{ ...post, id: 'third' },
							]}
						/>
					</div>
				) : (
					<BlogArticle post={data} />
				)}
				<footer style={{ height: 1000 }}>Footer</footer>
			</>
		),
	})
	const router = createRouter({
		routeTree: root.addChildren([route]),
		history: createMemoryHistory({ initialEntries: [entry] }),
	})
	await router.load()
	render(<RouterProvider router={router} />)
	await document.fonts.ready
	await waitFor(() =>
		expect(
			document.querySelector(
				cards ? '[data-slot="card"]' : 'article[aria-label="Blog post"]'
			)
		).not.toBeNull()
	)
	return router
}
const section = (index: number) =>
	document.getElementById(`section-${index}-${index}`)!
const active = () =>
	document.querySelector(
		'nav[aria-label="On this page"] a[aria-current="location"]'
	)!

function luminance(color: string) {
	const canvas = document.createElement('canvas')
	const context = canvas.getContext('2d')!
	context.fillStyle = color
	context.fillRect(0, 0, 1, 1)
	const channels = Array.from(context.getImageData(0, 0, 1, 1).data)
		.slice(0, 3)
		.map((channel) => {
			const value = channel / 255
			return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
		})
	return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

describe('blog article layout in Chromium', () => {
	it('supports keyboard TOC controls and readable metadata in light and dark themes', async () => {
		await page.viewport(1440, 800)
		await mount()
		const trigger = document.querySelector<HTMLButtonElement>('aside button')!
		trigger.focus()
		await userEvent.keyboard('{Enter}')
		await waitFor(() =>
			expect(trigger.getAttribute('aria-expanded')).toBe('false')
		)
		await userEvent.keyboard('{Enter}')
		await waitFor(() =>
			expect(trigger.getAttribute('aria-expanded')).toBe('true')
		)
		expect(getComputedStyle(trigger).outlineStyle).not.toBe('none')
		for (const dark of [false, true]) {
			document.documentElement.classList.toggle('dark', dark)
			const background = luminance(
				getComputedStyle(document.body).backgroundColor
			)
			for (const element of [
				trigger,
				document.querySelector(
					'nav[aria-label="On this page"] a:not([aria-current])'
				)!,
				document.querySelector('header p')!,
				section(0).querySelector('a')!,
			]) {
				const text = luminance(getComputedStyle(element).color)
				expect(
					(Math.max(text, background) + 0.05) /
						(Math.min(text, background) + 0.05)
				).toBeGreaterThanOrEqual(4.5)
			}
		}
	})
	it('reveals content permalinks on hover and keyboard focus, updates the URL and TOC, and shares the selected section', async () => {
		await page.viewport(1440, 800)
		const router = await mount(false, post, '/blogs/technology?ref=reading')
		const heading = section(4)
		const anchor = heading.querySelector<HTMLAnchorElement>('a')!
		const link = page.getByRole('link', {
			name: 'Link to Section 4',
			exact: true,
		})
		expect(getComputedStyle(anchor).opacity).toBe('0')
		await link.hover()
		expect(getComputedStyle(anchor).opacity).toBe('1')
		await page.getByText('Global navigation', { exact: true }).hover()
		anchor.focus()
		expect(getComputedStyle(anchor).opacity).toBe('1')
		expect(getComputedStyle(anchor).outlineStyle).not.toBe('none')
		await userEvent.keyboard('{Enter}')
		await waitFor(() => {
			expect(router.state.location.hash).toBe('section-4-4')
			expect(Math.abs(heading.getBoundingClientRect().top - 96)).toBeLessThan(2)
			expect(active().getAttribute('href')).toBe('#section-4-4')
		})
		expect(router.state.location.search).toEqual({ ref: 'reading' })
		expect(document.activeElement).toBe(heading)
		const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
		await page.getByRole('button', { name: 'Copy Link' }).click()
		expect(copy).toHaveBeenCalledWith(
			'https://altstack.test/blogs/technology?ref=reading#section-4-4'
		)
		const matchMedia = window.matchMedia.bind(window)
		vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
			query === '(prefers-reduced-motion: reduce)'
				? { ...matchMedia(query), matches: true }
				: matchMedia(query)
		)
		const scroll = vi.spyOn(section(6), 'scrollIntoView')
		await page
			.getByRole('link', { name: 'Link to Section 6', exact: true })
			.click()
		expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'instant' })
		await waitFor(() => {
			expect(router.state.location.hash).toBe('section-6-6')
			expect(
				Math.abs(section(6).getBoundingClientRect().top - 96)
			).toBeLessThan(2)
		})
	})
	it('keeps long headings and 44px permalink targets inside a mobile viewport', async () => {
		await page.viewport(320, 844)
		await mount(false, {
			...post,
			content: `## ${'Heading'.repeat(25)}\n\nArticle content.`,
		})
		const heading = document.querySelector(
			'article[aria-label="Article content"] h2'
		)!
		const anchor = heading.querySelector<HTMLAnchorElement>('a')!
		expect(anchor.getBoundingClientRect().width).toBeGreaterThanOrEqual(44)
		expect(anchor.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
		expect(anchor.getBoundingClientRect().left).toBeGreaterThanOrEqual(0)
		expect(anchor.getBoundingClientRect().right).toBeLessThanOrEqual(320)
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320)
		expect(getComputedStyle(anchor).opacity).toBe('1')
		anchor.focus()
		expect(getComputedStyle(anchor).opacity).toBe('1')
		await userEvent.keyboard('{Enter}')
		expect(document.activeElement).toBe(heading)
	})
	it('starts the TOC beside the cover, limits its height, follows scrolling, aligns anchor links, collapses, and stops before the footer', async () => {
		await page.viewport(1440, 800)
		const router = await mount()
		const toc = document.querySelector('aside [data-slot="collapsible"]')!
		const cover = document.querySelector('article > img')!
		const list = document.querySelector<HTMLOListElement>(
			'nav[aria-label="On this page"] ol'
		)!
		const share = document.querySelector('article > .sticky')!
		expect(
			Math.abs(
				toc.getBoundingClientRect().top - cover.getBoundingClientRect().top
			)
		).toBeLessThan(2)
		expect(list.scrollHeight).toBeGreaterThan(list.clientHeight)
		expect(toc.getBoundingClientRect().height).toBeLessThan(800 - 64)
		window.scrollTo(
			0,
			section(28).getBoundingClientRect().top + window.scrollY - 96
		)
		await waitFor(() =>
			expect(active().getAttribute('href')).toBe('#section-28-28')
		)
		expect(Math.abs(toc.getBoundingClientRect().top - 64)).toBeLessThan(2)
		expect(share.getBoundingClientRect().bottom).toBeLessThanOrEqual(800)
		await waitFor(() =>
			expect(active().getBoundingClientRect().bottom).toBeLessThanOrEqual(
				list.getBoundingClientRect().bottom + 1
			)
		)
		document
			.querySelector<HTMLAnchorElement>('a[href="#section-25-25"]')!
			.click()
		await waitFor(() =>
			expect(
				Math.abs(section(25).getBoundingClientRect().top - 96)
			).toBeLessThan(2)
		)
		expect(router.state.location.hash).toBe('section-25-25')
		expect(document.activeElement?.id).toBe('section-25-25')
		const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
		await page.getByRole('button', { name: 'Copy Link' }).click()
		expect(copy).toHaveBeenCalledWith(
			'https://altstack.test/blogs/technology#section-25-25'
		)
		expect(
			document.querySelector<HTMLAnchorElement>('a[title="Share on X"]')!.href
		).toContain(
			encodeURIComponent('https://altstack.test/blogs/technology#section-25-25')
		)
		await page.getByRole('button', { name: 'On this page' }).click()
		await waitFor(() =>
			expect(
				document.querySelector('nav[aria-label="On this page"]')
			).toBeNull()
		)
		await page.getByRole('button', { name: 'On this page' }).click()
		await waitFor(() =>
			expect(
				document.querySelector('nav[aria-label="On this page"]')
			).not.toBeNull()
		)
		const footer = document.querySelector('footer')!
		window.scrollTo(
			0,
			footer.getBoundingClientRect().top + window.scrollY - 100
		)
		await waitFor(() =>
			expect(toc.getBoundingClientRect().bottom).toBeLessThanOrEqual(
				footer.getBoundingClientRect().top
			)
		)
		expect(share.getBoundingClientRect().bottom).toBeLessThanOrEqual(
			footer.getBoundingClientRect().top
		)
	})

	it.each([320, 375, 768])(
		'truncates long breadcrumb titles on one line and shows one article date at %ipx',
		async (width) => {
			await page.viewport(width, 844)
			await mount(false, {
				...post,
				title:
					'Panduan Web Modern: Artikel Contoh untuk Menjelajahi Blog dengan Judul yang Panjang Sekali',
			})
			const breadcrumb = document.querySelector<HTMLElement>(
				'[data-slot="breadcrumb-page"]'
			)!
			expect(breadcrumb.title).toBe(breadcrumb.textContent)
			expect(breadcrumb.getBoundingClientRect().height).toBeLessThanOrEqual(21)
			expect(getComputedStyle(breadcrumb).textOverflow).toBe('ellipsis')
			expect(breadcrumb.scrollWidth).toBeGreaterThan(breadcrumb.clientWidth)
			const list = document.querySelector('[data-slot="breadcrumb-list"]')!
			expect(list.getBoundingClientRect().height).toBeLessThanOrEqual(21)
			expect(document.querySelectorAll('header time')).toHaveLength(1)
			expect(
				document.querySelector('header time')!.getAttribute('datetime')
			).toBe(post.updatedAt.toISOString())
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
		}
	)
	it.each([320, 390, 768])(
		'keeps the article, TOC and share bar inside a %ipx viewport',
		async (width) => {
			await page.viewport(width, 844)
			await mount()
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
			expect(
				document.querySelector('aside')!.getBoundingClientRect().bottom
			).toBeLessThanOrEqual(
				document.querySelector('article > img')!.getBoundingClientRect().top
			)
			window.scrollTo(
				0,
				section(4).getBoundingClientRect().top + window.scrollY - 96
			)
			await waitFor(() =>
				expect(active().getAttribute('href')).toBe('#section-4-4')
			)
			const share = document
				.querySelector('article > .sticky')!
				.getBoundingClientRect()
			expect(share.left).toBeGreaterThanOrEqual(0)
			expect(share.right).toBeLessThanOrEqual(width)
			expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
		}
	)
	it.each([
		[320, 1],
		[768, 2],
		[1440, 3],
	])('reflows cards at %ipx into %i columns', async (width, columns) => {
		await page.viewport(width, 844)
		await mount(true)
		const cards = Array.from(document.querySelectorAll('[data-slot="card"]'))
		expect(
			cards.filter(
				(card) =>
					Math.abs(
						card.getBoundingClientRect().top -
							cards[0].getBoundingClientRect().top
					) < 1
			)
		).toHaveLength(columns)
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
	})
})

vi.mock('#/features/public-content/server-function', () => {
	return {
		preparePublicContent: vi.fn(),
		preparePublicBlogContent: vi.fn(),
	}
})
