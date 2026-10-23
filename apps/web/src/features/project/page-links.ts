import type { LinkOptions, RegisteredRouter } from '@tanstack/react-router'

export function homeProjectPageLink(page: number) {
	return {
		from: '/' as const,
		to: '/' as const,
		search: (prev) => {
			return { ...prev, page: page === 1 ? undefined : page }
		},
	} satisfies LinkOptions<RegisteredRouter, '/', '/'>
}

export function categoryProjectPageLink(path: string, page: number) {
	return {
		from: '/categories/$' as const,
		to: '/categories/$' as const,
		params: { _splat: path },
		search: (prev) => {
			return { ...prev, page: page === 1 ? undefined : page }
		},
	} satisfies LinkOptions<RegisteredRouter, '/categories/$', '/categories/$'>
}

/** Builds tag-scoped pagination links while retaining project search and sort filters. */
export function tagProjectPageLink(slug: string, page: number) {
	return {
		from: '/tags/$slug' as const,
		to: '/tags/$slug' as const,
		params: { slug },
		search: (prev) => {
			return { ...prev, page: page === 1 ? undefined : page }
		},
	} satisfies LinkOptions<RegisteredRouter, '/tags/$slug', '/tags/$slug'>
}

export function licenseProjectPageLink(slug: string, page: number) {
	return {
		from: '/licenses/$slug' as const,
		to: '/licenses/$slug' as const,
		params: { slug },
		search: (prev) => {
			return { ...prev, page: page === 1 ? undefined : page }
		},
	} satisfies LinkOptions<
		RegisteredRouter,
		'/licenses/$slug',
		'/licenses/$slug'
	>
}

export type ProjectPageLinkOptions =
	| ReturnType<typeof licenseProjectPageLink>
	| ReturnType<typeof tagProjectPageLink>
	| ReturnType<typeof homeProjectPageLink>
	| ReturnType<typeof categoryProjectPageLink>
