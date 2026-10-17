import type { BadgeOptions } from './badge'

import { publicBadgeProject } from '@altstack/api/queries/seo'

// oxlint-disable-next-line import/no-relative-parent-imports -- Bundle the designer's public SVG as the single artwork source.
import artwork from '../../../../public/badge.svg?raw'
import { badgeParameters, escapeAttribute } from './badge'

const headers = {
	'Content-Type': 'text/plain; charset=utf-8',
	// No conditional shortcut or stale browser/CDN copy can bypass publication.
	'Cache-Control': 'no-store',
	'X-Content-Type-Options': 'nosniff',
	'X-Robots-Tag': 'noindex',
	'Cross-Origin-Resource-Policy': 'cross-origin',
}

// Trusted, bundled designer asset. Presentation attributes preserve the exported
// artwork under our style-src 'none' CSP without permitting inline CSS.
const darkArtwork = artwork
	.slice(
		artwork.indexOf('>', artwork.indexOf('<svg')) + 1,
		artwork.lastIndexOf('</svg>')
	)
	.replace(/<title>[^<]*<\/title>/, '')
	.replace(/ style="([^"]*)"/g, (_, declarations: string) =>
		declarations
			.split(';')
			.map((declaration) => {
				const [property, value] = declaration.split(':')
				return ` ${property}="${value}"`
			})
			.join('')
	)
const lightPalette: Record<string, string> = {
	'#101010': '#ffffff',
	'#383838': '#d4d4d4',
	'#ffffff': '#101010',
	'#b6b6b6': '#525252',
	'#e6e6e6': '#171717',
}
const lightArtwork = darkArtwork.replace(
	/#[0-9a-f]{6}/g,
	(color) => lightPalette[color] ?? color
)

export function renderBadge(name: string, options: BadgeOptions) {
	const { theme, width, height } = options
	const dark = theme === 'dark'
	// XML 1.0 cannot represent these controls or unpaired UTF-16 surrogates.
	const title = escapeAttribute(
		Array.from(name, (character) => {
			const code = character.codePointAt(0) ?? 0
			const valid =
				code === 9 ||
				code === 10 ||
				code === 13 ||
				(code >= 0x20 && code <= 0xd7ff) ||
				(code >= 0xe000 && code <= 0xfffd) ||
				code >= 0x10000
			return valid ? character : '\uFFFD'
		}).join('')
	)
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title">
  <title id="title">${title} badge — Listed on altstack</title>
  <svg width="${width}" height="${height}" viewBox="0 0 200 50" preserveAspectRatio="xMidYMid meet">${dark ? darkArtwork : lightArtwork}</svg>
</svg>`
}

export async function badgeResponse(request: Request, slug: string) {
	const respond = (body: string, status: number, extra = {}) =>
		new Response(request.method === 'HEAD' ? null : body, {
			status,
			headers: { ...headers, ...extra },
		})
	const options = badgeParameters(new URL(request.url).searchParams)
	if (!options) return respond('Invalid badge parameters', 400)
	try {
		// Select only public identity; no API session, private data or render cache.
		const project = await publicBadgeProject(slug)
		if (!project) return respond('Not found', 404)
		return respond(renderBadge(project.name, options), 200, {
			'Content-Type': 'image/svg+xml; charset=utf-8',
			'Content-Disposition': 'inline',
			'Content-Security-Policy':
				"default-src 'none'; style-src 'none'; sandbox",
		})
	} catch {
		return respond('Badge temporarily unavailable', 503, {
			'Retry-After': '30',
		})
	}
}
