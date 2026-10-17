import { JSDOM } from 'jsdom'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { badgeResponse } from '#/features/project/embed/response.server'
import artwork from '../public/badge.svg?raw'

const { lookup } = vi.hoisted(() => {
	return { lookup: vi.fn() }
})
vi.mock('@altstack/api/queries/seo', () => {
	return { publicBadgeProject: lookup }
})
vi.mock('@altstack/env/web', () => {
	return {
		env: { VITE_APP_URL: 'https://altstack.test' },
	}
})
beforeEach(() => {
	lookup.mockReset().mockResolvedValue({ name: 'Atlas & "Studio" <Kit>' })
})
function request(query = '', init?: RequestInit) {
	return badgeResponse(
		new Request(`https://untrusted.test/atlas/badge.svg${query}`, init),
		'atlas'
	)
}
describe('public badge response', () => {
	it('replaces XML-forbidden characters while retaining valid Unicode', async () => {
		lookup.mockResolvedValueOnce({ name: 'Atlas\u0001\uD800 工具 🚀' })
		const text = await (await request()).text()
		const doc = new JSDOM(text, { contentType: 'image/svg+xml' }).window
			.document
		expect(doc.querySelector('title')?.textContent).toContain('Atlas�� 工具 🚀')
	})
	it.each(['dark', 'light'])(
		'returns deterministic valid self-contained %s SVG with the supplied badge artwork',
		async (theme) => {
			const first = await request(`?theme=${theme}&width=320&height=80`)
			const text = await first.text()
			expect(
				await (await request(`?theme=${theme}&width=320&height=80`)).text()
			).toBe(text)
			const doc = new JSDOM(text, { contentType: 'image/svg+xml' }).window
				.document
			expect(doc.documentElement.getAttribute('width')).toBe('320')
			expect(doc.documentElement.getAttribute('height')).toBe('80')
			expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 320 80')
			expect(doc.querySelector('title')?.textContent).toBe(
				'Atlas & "Studio" <Kit> badge — Listed on altstack'
			)
			const source = new JSDOM(artwork, { contentType: 'image/svg+xml' }).window
				.document
			expect(
				Array.from(doc.querySelectorAll('path'), (path) =>
					path.getAttribute('d')
				)
			).toEqual(
				Array.from(source.querySelectorAll('path'), (path) =>
					path.getAttribute('d')
				)
			)
			expect(doc.querySelector('[style]')).toBeNull()
			expect(doc.querySelector('#badge > path')?.getAttribute('fill')).toBe(
				theme === 'dark' ? '#101010' : '#ffffff'
			)
			expect(
				doc.querySelector('svg svg')?.getAttribute('preserveAspectRatio')
			).toBe('xMidYMid meet')
			expect(
				doc.querySelector('script, foreignObject, image, style, a')
			).toBeNull()
			expect(text).not.toMatch(/https?:\/\/(?!www.w3.org)|featured|verified/i)
			expect(first.status).toBe(200)
			expect(first.headers.get('content-type')).toBe(
				'image/svg+xml; charset=utf-8'
			)
			expect(first.headers.get('content-disposition')).toBe('inline')
			expect(first.headers.get('cross-origin-resource-policy')).toBe(
				'cross-origin'
			)
			expect(first.headers.get('cache-control')).toBe('no-store')
			expect(first.headers.get('etag')).toBeNull()
			expect(first.headers.get('x-robots-tag')).toBe('noindex')
		}
	)
	it('uses defaults and ignores conditional headers only after a fresh publication read', async () => {
		const response = await request('', {
			headers: {
				'If-None-Match': '*',
				'If-Modified-Since': new Date().toUTCString(),
			},
		})
		expect(await response.text()).toContain('width="200" height="50"')
		expect(lookup).toHaveBeenCalledWith('atlas')
		lookup.mockResolvedValueOnce(undefined)
		const hidden = await request('', { headers: { 'If-None-Match': '*' } })
		expect(hidden.status).toBe(404)
		expect(await hidden.text()).toBe('Not found')
		expect(lookup).toHaveBeenCalledTimes(2)
	})
	it.each([
		'?theme=auto',
		'?width=Infinity',
		'?height=0',
		'?width=200.5',
		'?width=1201',
		'?height=401',
		'?width=',
		'?width=200&width=300',
	])('rejects %s without rendering', async (query) => {
		const response = await request(query)
		expect(response.status).toBe(400)
		expect(lookup).not.toHaveBeenCalled()
		expect(response.headers.get('cache-control')).toBe('no-store')
	})
	it('returns service failure rather than missing project and hides internal details', async () => {
		lookup.mockRejectedValueOnce(new Error('PRIVATE_DATABASE_SENTINEL'))
		const response = await request()
		expect(response.status).toBe(503)
		expect(await response.text()).toBe('Badge temporarily unavailable')
		expect(response.headers.get('retry-after')).toBe('30')
	})
	it('HEAD independently checks visibility and returns matching headers without a body', async () => {
		const response = await request('?theme=light', { method: 'HEAD' })
		expect(response.status).toBe(200)
		expect(response.headers.get('content-type')).toContain('image/svg+xml')
		expect(await response.text()).toBe('')
		lookup.mockResolvedValueOnce(undefined)
		expect((await request('', { method: 'HEAD' })).status).toBe(404)
		expect(lookup).toHaveBeenCalledTimes(2)
	})
})
