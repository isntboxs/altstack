import type { BadgeOptions } from './badge'

import { publicBadgeProject } from '@altstack/api/queries/seo'

import signature from '#/features/seo/og/assets/signature.svg?raw'
import { badgeParameters, escapeAttribute } from './badge'

const headers = {
	'Content-Type': 'text/plain; charset=utf-8',
	// No conditional shortcut or stale browser/CDN copy can bypass publication.
	'Cache-Control': 'no-store',
	'X-Content-Type-Options': 'nosniff',
	'X-Robots-Tag': 'noindex',
	'Cross-Origin-Resource-Policy': 'cross-origin',
}

// The bundled approved outlined signature keeps its original geometry/ratio.
const signaturePaths = signature.slice(
	signature.indexOf('<path'),
	signature.lastIndexOf('</svg>')
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
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="${dark ? '#101010' : '#ffffff'}" stroke="${dark ? '#383838' : '#d4d4d4'}"/>
  <svg width="${width}" height="${height}" viewBox="0 0 200 50" preserveAspectRatio="xMidYMid meet">
    <text x="67" y="14" fill="${dark ? '#b8b8b8' : '#525252'}" font-family="system-ui,sans-serif" font-size="8" letter-spacing="0.7">LISTED ON</text>
    <svg x="24" y="12" width="142" height="32.113074204947" viewBox="0 0 1132 256" fill="${dark ? '#ffffff' : '#000000'}">${signaturePaths}</svg>
  </svg>
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
