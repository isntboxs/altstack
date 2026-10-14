import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { LOGO_MAX_SIZE } from '@altstack/shared/constants'

import {
	loadProjectLogo,
	logoPng,
	trustedLogoUrl,
} from '#/features/seo/og/logo.server'

vi.mock('@altstack/env/web', () => {
	return { env: { VITE_S3_PUBLIC_URL: 'https://media.altstack.test/public' } }
})
afterEach(() => vi.unstubAllGlobals())
const key = 'projects/atlas/logo-00000000-0000-4000-8000-000000000001.png'
const logo = () =>
	sharp({ create: { width: 96, height: 96, channels: 4, background: '#000' } })
		.png()
		.toBuffer()

describe('project OG logo policy', () => {
	it('resolves only promoted storage keys and fixed numeric GitHub avatars', () => {
		expect(trustedLogoUrl(key)).toBe(
			'https://media.altstack.test/public/' + key
		)
		expect(trustedLogoUrl('https://media.altstack.test/public/' + key)).toBe(
			'https://media.altstack.test/public/' + key
		)
		expect(
			trustedLogoUrl('https://avatars.githubusercontent.com/u/123?s=9999&v=4')
		).toBe('https://avatars.githubusercontent.com/u/123?s=192')
		for (const value of [
			null,
			'',
			'tmp/logos/private.png',
			'../secret',
			'brand/logo.svg',
			'data:image/png;base64,abc',
			'file:///etc/passwd',
			'http://169.254.169.254/latest/meta-data',
			'https://media.altstack.test.evil.test/public/' + key,
			'https://evil.test/' + key,
			'https://user:pass@media.altstack.test/public/' + key,
			'https://media.altstack.test/public/' + key + '?url=private',
			'https://avatars.githubusercontent.com/u/123?url=http://localhost',
			'https://avatars.githubusercontent.com/../../private',
		]) {
			expect(trustedLogoUrl(value)).toBeNull()
		}
	})
	it('normalizes raster uploads (including WebP/GIF) to a small metadata-free PNG and rejects SVG/corruption/decode bombs', async () => {
		const input = sharp({
			create: { width: 256, height: 128, channels: 4, background: '#ff9900' },
		})
		for (const bytes of [
			await input.clone().png().toBuffer(),
			await input.clone().jpeg().toBuffer(),
			await input.clone().webp().toBuffer(),
			await input.clone().gif().toBuffer(),
		]) {
			const data = await logoPng(bytes)
			expect(data).toMatch(/^data:image\/png;base64,/)
			const metadata = await sharp(
				Buffer.from(data!.split(',')[1], 'base64')
			).metadata()
			expect(metadata.width).toBe(192)
			expect(metadata.height).toBe(96)
			expect(metadata.exif).toBeUndefined()
		}
		expect(
			await logoPng(
				Buffer.from(
					'<svg xmlns="http://www.w3.org/2000/svg"><image href="http://localhost/secret"/></svg>'
				)
			)
		).toBeNull()
		expect(
			await logoPng(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
		).toBeNull()
		expect(await logoPng(Buffer.alloc(LOGO_MAX_SIZE + 1))).toBeNull()
		const huge = await sharp({
			create: { width: 3000, height: 2000, channels: 3, background: '#000' },
		})
			.png()
			.toBuffer()
		expect(await logoPng(huge)).toBeNull()
	})
	it('fetches only the trusted target without redirects, with a deadline and raster MIME verification', async () => {
		const request = vi.fn<typeof fetch>().mockResolvedValue(
			new Response(new Uint8Array(await logo()), {
				headers: { 'Content-Type': 'image/png' },
			})
		)
		vi.stubGlobal('fetch', request)
		expect(await loadProjectLogo(key)).toMatch(/^data:image\/png;base64,/)
		expect(request.mock.calls[0]?.[0]).toBe(
			'https://media.altstack.test/public/' + key
		)
		const options = request.mock.calls[0]?.[1]
		expect(options?.redirect).toBe('error')
		expect(options?.signal).toBeInstanceOf(AbortSignal)
		expect(await loadProjectLogo('http://127.0.0.1/private')).toBeNull()
		expect(request).toHaveBeenCalledTimes(1)
	})
	it('falls back on timeout, missing files, MIME spoofing and oversized declared/streamed responses', async () => {
		const request = vi.fn<typeof fetch>()
		vi.stubGlobal('fetch', request)
		request.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
		expect(await loadProjectLogo(key)).toBeNull()
		request.mockResolvedValueOnce(new Response('missing', { status: 404 }))
		expect(await loadProjectLogo(key)).toBeNull()
		request.mockResolvedValueOnce(
			new Response('<svg><image href="http://localhost"/></svg>', {
				headers: { 'Content-Type': 'image/png' },
			})
		)
		expect(await loadProjectLogo(key)).toBeNull()
		request.mockResolvedValueOnce(
			new Response('png', {
				headers: {
					'Content-Type': 'image/png',
					'Content-Length': String(LOGO_MAX_SIZE + 1),
				},
			})
		)
		expect(await loadProjectLogo(key)).toBeNull()
		const cancel = vi.fn()
		request.mockResolvedValueOnce(
			new Response(
				new ReadableStream({
					start(controller) {
						controller.enqueue(new Uint8Array(LOGO_MAX_SIZE + 1))
					},
					cancel,
				}),
				{ headers: { 'Content-Type': 'image/png' } }
			)
		)
		expect(await loadProjectLogo(key)).toBeNull()
		expect(cancel).toHaveBeenCalledOnce()
	})
})
