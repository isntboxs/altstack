import { publicOgCategory, publicOgProject } from '@altstack/api/queries/seo'

import regularUrl from './assets/inter-400.ttf?inline'
import mediumUrl from './assets/inter-500.ttf?inline'
import signature from './assets/signature.svg?raw'
import { renderCard } from './card'

const resources = {
	regular: Buffer.from(regularUrl.split(',')[1], 'base64'),
	medium: Buffer.from(mediumUrl.split(',')[1], 'base64'),
	signature: `data:image/svg+xml;base64,${Buffer.from(signature).toString('base64')}`,
}
const headers = {
	'Cache-Control': 'no-store',
	'X-Content-Type-Options': 'nosniff',
}
export function missingImage() {
	return new Response('Not found', {
		status: 404,
		headers: { ...headers, 'X-Robots-Tag': 'noindex' },
	})
}

// A small single-flight cache avoids repeated rendering. Every hit first checks
// current public data, so unpublish/delete is effective on the next request.
const cache = new Map<string, Promise<Uint8Array>>()
let activeRenders = 0
export async function ogResponse(kind: 'project' | 'category', id: string) {
	if (
		!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
	) {
		return missingImage()
	}
	try {
		const row =
			kind === 'project'
				? await publicOgProject(id)
				: await publicOgCategory(id)
		if (!row) return missingImage()
		const description =
			'tagline' in row ? (row.tagline ?? row.description) : row.description
		const card = { kind, title: row.name, description, fallback: row.slug }
		const key = JSON.stringify(card)
		let rendering = cache.get(key)
		if (!rendering) {
			if (activeRenders >= 2) {
				return new Response('Image temporarily unavailable', {
					status: 503,
					headers: { ...headers, 'Retry-After': '5' },
				})
			}
			if (cache.size >= 32) cache.delete(cache.keys().next().value!)
			activeRenders++
			rendering = renderCard(card, resources).finally(() => {
				activeRenders--
			})
			cache.set(key, rendering)
			rendering.catch(() => cache.delete(key))
		}
		return new Response(new Uint8Array(await rendering).buffer, {
			headers: { ...headers, 'Content-Type': 'image/png' },
		})
	} catch {
		return new Response('Image temporarily unavailable', {
			status: 503,
			headers: { ...headers, 'Retry-After': '30', 'X-Robots-Tag': 'noindex' },
		})
	}
}
