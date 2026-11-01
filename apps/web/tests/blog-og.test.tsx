import { readFile } from 'node:fs/promises'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { blogHead } from '#/features/seo/blog-meta'
import { blogImage } from '#/features/seo/meta'
import { cardLayout, renderCard } from '#/features/seo/og/card'

vi.mock('@altstack/env/web', () => {
	return {
		env: {
			VITE_APP_URL: 'https://altstack.test',
			VITE_S3_PUBLIC_URL: 'https://media.altstack.test',
		},
	}
})
afterEach(() => vi.unstubAllGlobals())
const post: ORPCRouterOutputs['blog']['getBySlug'] = {
	id: '550e8400-e29b-41d4-a716-446655440001',
	title: 'Panduan Web Modern: Artikel Contoh untuk Menjelajahi Blog',
	slug: 'panduan-web-modern',
	description: 'Practical ideas for building software and sharing knowledge.',
	coverUrl: 'https://images.test/cover.jpg',
	content: '## Introduction',
	authorName: 'Alex Morgan',
	authorImage: null,
	publishedAt: new Date('2026-10-01T00:00:00Z'),
	updatedAt: new Date('2026-10-02T00:00:00Z'),
	readTime: 10,
}
const card = {
	kind: 'blog' as const,
	title: post.title,
	fallback: post.slug,
	description: post.description,
	authorName: post.authorName,
	publishedAt: post.publishedAt,
	updatedAt: post.updatedAt,
	readTime: post.readTime,
}

describe('branded blog social cards', () => {
	it('uses versioned dynamic PNG metadata for OG and Twitter with a canonical URL', () => {
		const head = blogHead(post)
		const image = `https://altstack.test${blogImage(post.id, post.updatedAt)}`
		expect(head.meta).toContainEqual({ property: 'og:image', content: image })
		expect(head.meta).toContainEqual({ name: 'twitter:image', content: image })
		expect(head.meta).toContainEqual({
			name: 'twitter:url',
			content: 'https://altstack.test/blogs/panduan-web-modern',
		})
		expect(head.meta).toContainEqual({
			property: 'og:type',
			content: 'article',
		})
		expect(head.meta).toContainEqual({
			property: 'og:image:type',
			content: 'image/png',
		})
		expect(blogImage(post.id, new Date('2026-10-03T00:00:00Z'))).not.toBe(
			blogImage(post.id, post.updatedAt)
		)
	})
	it('keeps the approved signature, monochrome frame and real article metadata without fetching a cover', () => {
		const html = renderToStaticMarkup(
			cardLayout(card, 'data:image/svg+xml;base64,c2lnbmF0dXJl')
		)
		expect(html).toContain('altstack blog')
		expect(html).toContain('Alex Morgan')
		expect(html).toContain('Updated: October 2, 2026')
		expect(html).toContain('10 min read')
		expect(html).not.toContain('Published:')
		expect(html).not.toContain(post.coverUrl)
		expect(html).toContain('data:image/svg+xml;base64,c2lnbmF0dXJl')
		const original = renderToStaticMarkup(
			cardLayout({ ...card, updatedAt: post.publishedAt }, 'signature')
		)
		expect(original).toContain('Published: October 1, 2026')
		expect(original).not.toContain('Updated:')
	})
	it('renders deterministic 1200 × 630 PNGs offline for long, Unicode and updated articles', async () => {
		vi.stubGlobal('fetch', () => {
			throw new Error('Blog OG must not fetch external assets')
		})
		const assets = new URL('../src/features/seo/og/assets/', import.meta.url)
		const resources = {
			regular: await readFile(new URL('inter-400.ttf', assets)),
			medium: await readFile(new URL('inter-500.ttf', assets)),
			signature: `data:image/svg+xml;base64,${(await readFile(new URL('signature.svg', assets))).toString('base64')}`,
		}
		const first = Buffer.from(await renderCard(card, resources))
		expect(first.readUInt32BE(16)).toBe(1200)
		expect(first.readUInt32BE(20)).toBe(630)
		expect(first.equals(Buffer.from(await renderCard(card, resources)))).toBe(
			true
		)
		const changed = Buffer.from(
			await renderCard(
				{ ...card, title: 'A different article title' },
				resources
			)
		)
		expect(changed.equals(first)).toBe(false)
		const long = Buffer.from(
			await renderCard(
				{
					...card,
					title: 'W'.repeat(200),
					description: 'An article '.repeat(100),
					authorName: 'A long author name '.repeat(20),
				},
				resources
			)
		)
		expect(long.readUInt32BE(16)).toBe(1200)
		const unicode = Buffer.from(
			await renderCard(
				{ ...card, title: '工具 🚀', description: null },
				resources
			)
		)
		expect(unicode.readUInt32BE(20)).toBe(630)
	})
})
