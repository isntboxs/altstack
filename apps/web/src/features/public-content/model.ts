import { RESERVED_PROJECT_SLUGS } from '@altstack/shared/constants'

export type ProjectMention = {
	slug: string
	name: string
	verified?: boolean
	logo: string | null
	tagline: string | null
	stars: number
	forks: number
}

export type CodeTokenStyle = {
	color?: string
	bgColor?: string
	fontStyle?: number
}

export type CodeToken = {
	content: string
	light: CodeTokenStyle
	dark: CodeTokenStyle
}

export type PreparedCodeBlock = {
	code: string
	language: string
	tokens?: Array<Array<CodeToken>>
	colors?: { light: CodeTokenStyle; dark: CodeTokenStyle }
}

export type PreparedPublicContent = {
	codeBlocks: Record<string, PreparedCodeBlock>
	projectsBySlug: Record<string, ProjectMention>
}

export const publicContentQueryKey = ['public-content'] as const

export function emptyPublicContent(): PreparedPublicContent {
	return { codeBlocks: {}, projectsBySlug: {} }
}

/** Recognizes project links while excluding the shared set of site routes. */
export function projectSlugFromPath(path: string) {
	const match = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(path)
	return match && !RESERVED_PROJECT_SLUGS.has(match[1]) ? match[1] : undefined
}

/** Resolves safe web links and recognizes explicit project mentions on this origin. */
export function contentLink(href: string, slug: string, appUrl: string) {
	if (!href || href.startsWith('#')) return null
	try {
		const origin = new URL(appUrl).origin
		const url = new URL(href, `${origin}/${encodeURIComponent(slug)}`)
		if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
		const internal = url.origin === origin && !url.username && !url.password
		// Only explicit site links are mentions; relative README paths remain links.
		const explicit = href.startsWith('/') || /^https?:\/\//i.test(href)
		const projectSlug =
			internal && explicit ? projectSlugFromPath(url.pathname) : undefined
		return { url, internal, projectSlug }
	} catch {
		return null
	}
}
