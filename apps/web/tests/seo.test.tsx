// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { jsonLd } from '#/features/seo/meta'
import {
	cardText,
	fitLines,
	githubCount,
	renderCard,
} from '#/features/seo/og/card'

afterEach(() => vi.unstubAllGlobals())

describe('OG rendering boundaries', () => {
	it('uses Inter glyphs without network fallbacks and retains supported Unicode', () => {
		expect(cardText('café — Ελληνικά — Привет 🚀')).toBe(
			'café — Ελληνικά — Привет'
		)
		expect(cardText('工具 🚀', 'public-slug')).toBe('public-slug')
		expect(cardText('\u202Eevil')).toBe('evil')
	})
	it('wraps words and bounds long unbroken names at the preview grid', () => {
		const words = fitLines('Useful software for developers', 300, 30, 3)
		expect(words).toHaveLength(2)
		expect(words.join(' ')).toBe('Useful software for developers')
		const lines = fitLines('W'.repeat(1000), 778, 48, 3)
		expect(lines).toHaveLength(3)
		expect(lines[2]).toMatch(/…$/)
		expect(lines.every((line) => line.length < 20)).toBe(true)
	})
	it('formats stored GitHub counts without turning unknown values into zero', () => {
		expect(githubCount(91699)).toBe('91,699')
		expect(githubCount(0)).toBe('0')
		expect(githubCount(1_234_567)).toBe('1.2M')
		for (const count of [-1, NaN, Infinity, 1.5]) {
			expect(githubCount(count)).toBeNull()
		}
	})
	it('renders deterministic 1200 × 630 PNGs offline, including missing and Unicode copy', async () => {
		vi.stubGlobal('fetch', () => {
			throw new Error('OG must render without outbound fetch')
		})
		const assets = new URL('../src/features/seo/og/assets/', import.meta.url)
		const resources = {
			regular: await readFile(new URL('inter-400.ttf', assets)),
			medium: await readFile(new URL('inter-500.ttf', assets)),
			signature:
				'data:image/svg+xml;base64,' +
				(await readFile(new URL('signature.svg', assets))).toString('base64'),
		}
		const input = {
			kind: 'project' as const,
			title: '工具 🚀',
			fallback: 'public-project',
			description: null,
			github: {
				licenseKey: null,
				licenseName: null,
				licenseSpdxId: null,
				licenseSlug: null,
				licenseUrl: null,
				archived: null,
				owner: 'fixture',
				repo: 'public',
				stars: 91699,
				forks: 5412,
				fetchedAt: '2026-10-15T00:00:00Z',
			},
		}
		const first = Buffer.from(await renderCard(input, resources))
		expect(first.equals(Buffer.from(await renderCard(input, resources)))).toBe(
			true
		)
		expect(first.readUInt32BE(16)).toBe(1200)
		expect(first.readUInt32BE(20)).toBe(630)
		const home = Buffer.from(await renderCard({ kind: 'home' }, resources))
		expect(
			home.equals(
				await readFile(new URL('../public/og/default.png', import.meta.url))
			)
		).toBe(true)
	})
})

describe('structured-data escaping', () => {
	it('round-trips hostile public copy without HTML script delimiters or line separators', () => {
		const data = { name: '</script><script>alert("x")</script>&\u2028\u2029' }
		const serialized = jsonLd(data)
		expect(serialized).not.toMatch(/[<>&\u2028\u2029]/)
		expect(JSON.parse(serialized)).toEqual(data)
	})
})
