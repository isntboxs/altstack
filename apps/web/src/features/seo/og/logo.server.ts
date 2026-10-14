import sharp from 'sharp'

import { env } from '@altstack/env/web'

import { LOGO_MAX_SIZE } from '@altstack/shared/constants'
import { projectLogoKeySchema } from '@altstack/shared/schemas/upload'

// Reconstruct URLs from a narrow public asset policy, never from arbitrary
// query parameters. Redirects, credentials and arbitrary hosts are rejected.
export function trustedLogoUrl(
	value: string | null | undefined,
	storageBase = env.VITE_S3_PUBLIC_URL
) {
	if (!value) return null
	const base = new URL(
		storageBase.endsWith('/') ? storageBase : storageBase + '/'
	)
	if (
		!['http:', 'https:'].includes(base.protocol) ||
		base.username ||
		base.password ||
		base.search ||
		base.hash
	) {
		return null
	}
	if (projectLogoKeySchema.safeParse(value).success) {
		return new URL(value, base).href
	}
	let url: URL
	try {
		url = new URL(value)
	} catch {
		return null
	}
	if (url.username || url.password || url.hash) return null
	if (
		url.origin === base.origin &&
		url.href.startsWith(base.href) &&
		!url.search
	) {
		const key = url.pathname.slice(base.pathname.length)
		if (projectLogoKeySchema.safeParse(key).success) {
			return new URL(key, base).href
		}
	}
	// Existing imported GitHub avatars. Only numeric public account identifiers,
	// fixed origin/path and a fixed small size reach the network.
	if (url.origin === 'https://avatars.githubusercontent.com') {
		const id = /^\/u\/([1-9]\d{0,19})\/?$/.exec(url.pathname)?.[1]
		if (
			id &&
			Array.from(url.searchParams.keys()).every(
				(key) => key === 's' || key === 'v'
			)
		) {
			return `https://avatars.githubusercontent.com/u/${id}?s=192`
		}
	}
	return null
}

function rasterMime(bytes: Buffer) {
	if (
		bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
	) {
		return 'image/png'
	}
	if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
		return 'image/jpeg'
	}
	if (['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) {
		return 'image/gif'
	}
	if (
		bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
		bytes.subarray(8, 12).toString('ascii') === 'WEBP'
	) {
		return 'image/webp'
	}
	return null
}

// Buffer input only; SVG never reaches a decoder (even with a spoofed MIME).
// First-frame rasterisation strips metadata and bounds decode/output work.
export async function logoPng(bytes: Buffer) {
	if (bytes.length > LOGO_MAX_SIZE || !rasterMime(bytes)) return null
	try {
		const png = await sharp(bytes, {
			limitInputPixels: 4_194_304,
			failOn: 'warning',
			animated: false,
		})
			.resize(192, 192, { fit: 'inside', withoutEnlargement: true })
			.timeout({ seconds: 1 })
			.png()
			.toBuffer()
		return `data:image/png;base64,${png.toString('base64')}`
	} catch {
		return null
	}
}

export async function loadProjectLogo(value: string | null | undefined) {
	const url = trustedLogoUrl(value)
	if (!url) return null
	try {
		const response = await fetch(url, {
			redirect: 'error',
			signal: AbortSignal.timeout(2000),
			headers: { Accept: 'image/png,image/jpeg,image/webp,image/gif' },
		})
		if (!response.ok || !response.body) return null
		const size = Number(response.headers.get('content-length'))
		const mime = response.headers
			.get('content-type')
			?.split(';')[0]
			.trim()
			.toLowerCase()
		if (
			size > LOGO_MAX_SIZE ||
			!mime ||
			!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mime)
		) {
			await response.body.cancel()
			return null
		}
		const reader = response.body.getReader()
		const chunks: Array<Uint8Array> = []
		let total = 0
		try {
			for (;;) {
				const { value: chunk, done } = await reader.read()
				if (done) break
				total += chunk.length
				if (total > LOGO_MAX_SIZE) return null
				chunks.push(chunk)
			}
		} finally {
			await reader.cancel()
		}
		const bytes = Buffer.concat(chunks)
		if (rasterMime(bytes) !== mime) return null
		return await logoPng(bytes)
	} catch {
		return null
	}
}
