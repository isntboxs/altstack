import { describe, expect, it, vi } from 'vite-plus/test'

import {
	campaignPeriod,
	eligibleAd,
	ctaForeground,
} from '@altstack/shared/schemas/ads'

import {
	listingSlots,
	pageOffset,
	recordPage,
	readSession,
	selectAds,
	SELECTION_TTL,
	weightedAds,
} from '#/features/ads/selection'
import type { PageLedger, Selection } from '#/features/ads/selection'
import { campaign, now } from './ads-fixtures'

const pool = [
	campaign('one', 'tier1'),
	campaign('two'),
	campaign('three', 'tier3'),
	campaign('four'),
	campaign('five'),
	campaign('six'),
]
describe('monthly campaign selection', () => {
	it('uses exclusive UTC month boundaries across leap years and year rollover', () => {
		expect(campaignPeriod('2028-02', 1)).toEqual({
			startsAt: new Date('2028-02-01T00:00:00Z'),
			endsAt: new Date('2028-03-01T00:00:00Z'),
		})
		expect(campaignPeriod('2026-12', 2).endsAt.toISOString()).toBe(
			'2027-02-01T00:00:00.000Z'
		)
		expect(eligibleAd(pool[1], 'banner', pool[1].endsAt.getTime())).toBe(false)
		expect(eligibleAd(pool[1], 'banner', pool[1].startsAt.getTime())).toBe(true)
	})
	it('enforces tier, status, future start and expiry on every placement', () => {
		for (const placement of ['banner', 'project-detail', 'sponsors'] as const) {
			expect(eligibleAd(pool[0], placement, now)).toBe(false)
		}
		for (const placement of [
			'listing',
			'collection-detail',
			'corner',
		] as const) {
			expect(eligibleAd(pool[0], placement, now)).toBe(true)
		}
		expect(eligibleAd({ ...pool[1], status: 'inactive' }, 'listing', now)).toBe(
			false
		)
		expect(
			eligibleAd({ ...pool[1], startsAt: new Date(now + 1) }, 'corner', now)
		).toBe(false)
	})
	it('assigns exact 1:1:2 ticket ranges without shortening any interval', () => {
		const counts = new Map<string, number>()
		for (let i = 0; i < 400; i++) {
			const id = weightedAds(pool.slice(0, 3), 1, [], () => (i + 0.5) / 400)[0]
				.id
			counts.set(id, (counts.get(id) ?? 0) + 1)
		}
		expect([...counts.values()]).toEqual([100, 100, 200])
	})
	it('keeps timestamps across navigation/reload, then chooses a fresh unique set at TTL', () => {
		const first = selectAds(pool, 'listing', 3, now, undefined, () => 0)
		const memory = new Map([['selection', JSON.stringify(first)]])
		const restored = readSession<Selection>('selection', first, {
			getItem: (key) => memory.get(key) ?? null,
			setItem: (key, value) => {
				memory.set(key, value)
			},
		})
		expect(
			selectAds(
				pool,
				'listing',
				3,
				now + SELECTION_TTL - 1,
				restored,
				() => 0.99
			)
		).toEqual(first)
		const next = selectAds(
			pool,
			'listing',
			3,
			now + SELECTION_TTL,
			restored,
			() => 0
		)
		expect(next.ids.every((id) => !first.ids.includes(id))).toBe(true)
		expect(next.selectedAt).toBe(now + SELECTION_TTL)
	})
	it('removes deactivated campaigns before TTL and does not repeat advertisers', () => {
		const first = selectAds(pool, 'listing', 3, now, undefined, () => 0)
		const inactive = pool.map((ad) =>
			ad.id === first.ids[0] ? { ...ad, status: 'inactive' as const } : ad
		)
		expect(selectAds(inactive, 'listing', 3, now + 1, first).ids).not.toContain(
			first.ids[0]
		)
		const duplicate = {
			...pool[0],
			id: 'overlap',
			websiteUrl: 'https://www.one.example.test/another',
		}
		expect(weightedAds([pool[0], duplicate], 3)).toHaveLength(1)
	})
	it('returns all three distinct advertisers when the inventory has exactly three', () => {
		expect(
			new Set(selectAds(pool.slice(0, 3), 'listing', 3, now).ids).size
		).toBe(3)
	})
	it('changes a three-slot listing set when only one fresh advertiser remains', () => {
		const first = selectAds(
			pool.slice(0, 4),
			'listing',
			3,
			now,
			undefined,
			() => 0
		)
		const next = selectAds(
			pool.slice(0, 4),
			'listing',
			3,
			now + SELECTION_TTL,
			first,
			() => 0
		)
		expect(next.ids).toContain('four')
		expect(next.ids).not.toEqual(first.ids)
	})
	it('recovers from corrupt storage and gives CTA text at least AA contrast', () => {
		expect(
			readSession('bad', [], { getItem: () => '{bad', setItem: vi.fn() })
		).toEqual([])
		expect(ctaForeground('#ffffff')).toBe('#000000')
		expect(ctaForeground('#000000')).toBe('#ffffff')
	})
})
describe('listing insertion and session page boundaries', () => {
	const items = Array.from({ length: 180 }, (_, id) => {
		return { id }
	})
	it.each([false, true])(
		'places ads at exact positions (mobile=%s) in 45 display slots',
		(mobile) => {
			const slots = listingSlots(items, pool.slice(0, 3), mobile)
			expect(slots).toHaveLength(45)
			expect(slots.flatMap((slot, i) => ('ad' in slot ? [i + 1] : []))).toEqual(
				mobile ? [3, 15, 29] : [3, 18, 33]
			)
			expect(slots.filter((slot) => 'item' in slot)).toHaveLength(42)
		}
	)
	it.each([0, 1, 2, 3])(
		'backfills missing/blocked ads with content (inventory %s)',
		(count) => {
			const slots = listingSlots(items, pool.slice(0, count), false)
			expect(slots).toHaveLength(45)
			expect(slots.filter((slot) => 'item' in slot)).toHaveLength(45 - count)
		}
	)
	it('consumes every item once across sequential pages with changing inventory and responsive layout', () => {
		let ledger: PageLedger = {}
		const seen: Array<number> = []
		for (let page = 1; page <= 5; page++) {
			const offset = pageOffset(ledger, page)
			const content = listingSlots(
				items.slice(offset, offset + 45),
				pool.slice(0, [3, 0, 1, 2, 0][page - 1]),
				page % 2 === 0
			).flatMap((slot) => ('item' in slot ? [slot.item.id] : []))
			seen.push(...content)
			ledger = recordPage(ledger, page, offset, content.length)
		}
		expect(seen).toEqual(items.map((item) => item.id))
		expect(new Set(seen).size).toBe(seen.length)
	})
	it('invalidates downstream boundaries after a revisited page changes capacity', () => {
		let ledger = recordPage({}, 1, 0, 42)
		ledger = recordPage(ledger, 2, 42, 42)
		ledger = recordPage(ledger, 3, 84, 42)
		ledger = recordPage(ledger, 1, 0, 45)
		expect(ledger).toEqual({ '1': 0, '2': 45 })
		expect(pageOffset(ledger, 3)).toBe(90)
	})
})
