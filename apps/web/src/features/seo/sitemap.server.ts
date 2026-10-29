import {
	sitemapCollections,
	sitemapCategories,
	sitemapLicenses,
	sitemapPageSize,
	sitemapProjectCount,
	sitemapProjects,
} from '@altstack/api/queries/seo'

import { publicUrl } from './meta'

export function sitemapUnavailable() {
	return new Response('Sitemap temporarily unavailable', {
		status: 503,
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-store',
			'Retry-After': '30',
			'X-Robots-Tag': 'noindex',
		},
	})
}

export function xmlText(value: string) {
	return value.replace(
		/[<>&"']/g,
		(char) =>
			({
				'<': '&lt;',
				'>': '&gt;',
				'&': '&amp;',
				'"': '&quot;',
				"'": '&apos;',
			})[char]!
	)
}
function xml(body: string) {
	return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'no-store',
			'X-Content-Type-Options': 'nosniff',
		},
	})
}
function urls(entries: Array<{ path: string; modified?: Date }>) {
	return xml(
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(({ path, modified }) => `<url><loc>${xmlText(publicUrl(path))}</loc>${modified && Number.isFinite(modified.getTime()) ? `<lastmod>${modified.toISOString()}</lastmod>` : ''}</url>`).join('')}</urlset>`
	)
}
export async function sitemapIndex() {
	const pages = Math.ceil((await sitemapProjectCount()) / sitemapPageSize)
	return xml(
		`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/sitemaps/pages.xml', ...Array.from({ length: pages }, (_, i) => `/sitemaps/projects/${i + 1}`)].map((path) => `<sitemap><loc>${xmlText(publicUrl(path))}</loc></sitemap>`).join('')}</sitemapindex>`
	)
}
export async function sitemapPages() {
	const [categories, licenses, collections] = await Promise.all([
		sitemapCategories(),
		sitemapLicenses(),
		sitemapCollections(),
	])
	return urls([
		{ path: '/' },
		{ path: '/categories' },
		{ path: '/collections' },
		...collections.map((item) => {
			return {
				path: `/collections/${item.slug}`,
				modified: item.updatedAt,
			}
		}),
		{ path: '/licenses' },
		...licenses
			.filter((license) => license.slug !== 'unknown')
			.map((license) => {
				return { path: `/licenses/${license.slug}` }
			}),
		{ path: '/activity' },
		...categories.map((category) => {
			return { path: `/categories/${category.path}` }
		}),
	])
}
export async function sitemapProjectPage(value: string) {
	if (!/^[1-9]\d{0,5}$/.test(value)) {
		return new Response('Not found', {
			status: 404,
			headers: { 'Cache-Control': 'no-store' },
		})
	}
	const entries = await sitemapProjects(Number(value))
	if (entries.length === 0) {
		return new Response('Not found', {
			status: 404,
			headers: { 'Cache-Control': 'no-store' },
		})
	}
	return urls(
		entries.map((entry) => {
			return {
				path: `/${encodeURIComponent(entry.slug)}`,
				modified: entry.updatedAt,
			}
		})
	)
}
