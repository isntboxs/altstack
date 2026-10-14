import { env } from '@altstack/env/web'

export const siteDescription =
	'Find quality open-source projects, compare alternatives, and explore developer tools.'
export const defaultImage = '/og/default.png'
export const ogVersion = '1'

export function publicUrl(path: string) {
	return new URL(path, new URL(env.VITE_APP_URL).origin).href
}

export function jsonLd(value: unknown) {
	return JSON.stringify(value)
		.replaceAll('<', '\\u003c')
		.replaceAll('>', '\\u003e')
		.replaceAll('&', '\\u0026')
		.replaceAll('\u2028', '\\u2028')
		.replaceAll('\u2029', '\\u2029')
}

export function siteGraph() {
	return [
		{
			'@type': 'Organization',
			'@id': publicUrl('/#organization'),
			name: 'AltStack',
			url: publicUrl('/'),
			logo: publicUrl('/logo512.png'),
		},
		{
			'@type': 'WebSite',
			'@id': publicUrl('/#website'),
			name: 'AltStack',
			url: publicUrl('/'),
			description: siteDescription,
			publisher: { '@id': publicUrl('/#organization') },
		},
	]
}

export function seoHead(options: {
	title: string
	description: string
	path?: string
	image?: string
	imageAlt?: string
	noindex?: boolean
	entities?: Array<Record<string, unknown>>
}) {
	const { title, description, path, noindex = false } = options
	const image = publicUrl(options.image ?? defaultImage)
	const imageAlt =
		options.imageAlt ??
		"AltStack — discover open-source software you'll actually use."
	return {
		meta: [
			{ title },
			{ name: 'description', content: description },
			{
				name: 'robots',
				content: noindex
					? 'noindex, follow'
					: 'index, follow, max-image-preview:large',
			},
			{ property: 'og:title', content: title },
			{ property: 'og:description', content: description },
			{ property: 'og:type', content: 'website' },
			{ property: 'og:site_name', content: 'AltStack' },
			{ property: 'og:url', content: path ? publicUrl(path) : publicUrl('/') },
			{ property: 'og:image', content: image },
			{ property: 'og:image:width', content: '1200' },
			{ property: 'og:image:height', content: '630' },
			{ property: 'og:image:type', content: 'image/png' },
			{ property: 'og:image:alt', content: imageAlt },
			{ name: 'twitter:card', content: 'summary_large_image' },
			{ name: 'twitter:title', content: title },
			{ name: 'twitter:description', content: description },
			{ name: 'twitter:image', content: image },
			{ name: 'twitter:image:alt', content: imageAlt },
		],
		links: path ? [{ rel: 'canonical', href: publicUrl(path) }] : [],
		scripts: options.entities
			? [
					{
						type: 'application/ld+json',
						children: jsonLd({
							'@context': 'https://schema.org',
							'@graph': [...siteGraph(), ...options.entities],
						}),
					},
				]
			: [],
	}
}

export function unavailableHead() {
	return seoHead({
		title: 'Page unavailable | AltStack',
		description:
			'This page is unavailable. Explore public open-source projects on AltStack.',
		noindex: true,
	})
}

export function cataloguePolicy(
	path: string,
	search: { q?: string; category?: string; sort?: string; page?: number },
	totalPages = Infinity
) {
	const filtered = Boolean(
		Boolean(search.q) ||
		Boolean(search.category) ||
		Boolean(search.sort && search.sort !== 'newest')
	)
	const page = search.page ?? 1
	return {
		path: !filtered && page > 1 ? `${path}?page=${page}` : path,
		noindex: filtered || (page > 1 && page > totalPages),
		pageSuffix: !filtered && page > 1 ? ` — Page ${page}` : '',
	}
}

export function projectImage(id: string, revision: string | Date) {
	return `/og/project/${encodeURIComponent(id)}?v=${ogVersion}-${encodeURIComponent(new Date(revision).toISOString())}`
}

export function categoryImage(
	id: string,
	name: string,
	description?: string | null
) {
	// Content revision affects crawler refresh; endpoint still checks live public data.
	let hash = 2166136261
	for (const char of `${name}\n${description ?? ''}`) {
		hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
	}
	return `/og/category/${encodeURIComponent(id)}?v=${ogVersion}-${(hash >>> 0).toString(36)}`
}
