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

export type ProjectPageLinkOptions =
	| ReturnType<typeof homeProjectPageLink>
	| ReturnType<typeof categoryProjectPageLink>
