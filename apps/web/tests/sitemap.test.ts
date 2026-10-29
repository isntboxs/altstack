import { describe, expect, it, vi } from 'vite-plus/test'

import {
	sitemapPages,
	sitemapProjectPage,
	sitemapUnavailable,
} from '#/features/seo/sitemap.server'

vi.mock('@altstack/env/web', () => {
	return {
		env: { VITE_APP_URL: 'https://altstack.test' },
	}
})

vi.mock('@altstack/api/queries/seo', () => {
	return {
		sitemapPageSize: 1000,
		sitemapProjectCount: vi.fn(),
		sitemapCategories: vi.fn().mockResolvedValue([]),
		sitemapLicenses: vi.fn().mockResolvedValue([]),
		sitemapCollections: vi.fn().mockResolvedValue([
			{
				slug: 'editorial-tools',
				updatedAt: new Date('2026-10-29T00:00:00Z'),
			},
		]),
		sitemapProjects: vi
			.fn()
			.mockResolvedValue([
				{ slug: 'public-<&"\'>', updatedAt: new Date('2026-10-14T00:00:00Z') },
			]),
	}
})

describe('sitemap serialization', () => {
	it('includes collection discovery and eligible collection revisions', async () => {
		const xml = await (await sitemapPages()).text()
		expect(xml).toContain('/collections</loc>')
		expect(xml).toContain(
			'/collections/editorial-tools</loc><lastmod>2026-10-29T00:00:00.000Z</lastmod>'
		)
	})
	it('encodes public paths, escapes XML and emits a real UTC modification date', async () => {
		const response = await sitemapProjectPage('1')
		const xml = await response.text()
		expect(response.headers.get('content-type')).toContain('application/xml')
		expect(xml).toContain('public-%3C%26%22&apos;%3E')
		expect(xml).toContain('<lastmod>2026-10-14T00:00:00.000Z</lastmod>')
	})
	it('rejects unbounded/invalid shard requests before querying and returns a generic retryable failure', async () => {
		for (const page of ['0', '-1', 'NaN', '1000000', '1.5']) {
			expect((await sitemapProjectPage(page)).status).toBe(404)
		}
		const error = sitemapUnavailable()
		expect(error.status).toBe(503)
		expect(error.headers.get('cache-control')).toBe('no-store')
		expect(await error.text()).toBe('Sitemap temporarily unavailable')
	})
})
