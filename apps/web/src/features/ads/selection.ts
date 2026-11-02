import { eligibleAd } from '@altstack/shared/schemas/ads'
import type { AdCampaign, AdPlacement } from '@altstack/shared/schemas/ads'

export const SELECTION_TTL = 180_000
export const CORNER_INTERVAL = 15_000
export interface Selection {
	ids: Array<string>
	selectedAt: number
}
export interface SessionStore {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
}
const fallback = new Map<string, string>()
export function sessionStore(): SessionStore {
	return {
		getItem(key) {
			try {
				return sessionStorage.getItem(key)
			} catch {
				return fallback.get(key) ?? null
			}
		},
		setItem(key, value) {
			fallback.set(key, value)
			try {
				sessionStorage.setItem(key, value)
			} catch {
				/* Storage may be disabled; retain this document's selections. */
			}
		},
	}
}
export function readSession<T>(
	key: string,
	initial: T,
	storage = sessionStore()
): T {
	try {
		return (JSON.parse(storage.getItem(key) ?? 'null') as T) ?? initial
	} catch {
		return initial
	}
}
export function weightedAds(
	pool: Array<AdCampaign>,
	count: number,
	previous: Array<string> = [],
	random = Math.random
) {
	const chosen: Array<AdCampaign> = []
	const remaining = [...pool]
	while (chosen.length < count && remaining.length > 0) {
		// Prefer new advertisers only when that can fill the entire requested set.
		const fresh = remaining.filter((ad) => !previous.includes(ad.id))
		const needsNewAdvertiser =
			chosen.length === count - 1 &&
			chosen.every((ad) => previous.includes(ad.id))
		const candidates =
			fresh.length >= count - chosen.length ||
			(needsNewAdvertiser && fresh.length > 0)
				? fresh
				: remaining
		const total = candidates.reduce(
			(sum, ad) => sum + (ad.tier === 'tier3' ? 2 : 1),
			0
		)
		let ticket = random() * total
		const next =
			candidates.find((ad) => {
				ticket -= ad.tier === 'tier3' ? 2 : 1
				return ticket < 0
			}) ?? candidates[candidates.length - 1]
		chosen.push(next)
		// A website host represents an advertiser across overlapping campaigns.
		const advertiser = new URL(next.websiteUrl).hostname
			.replace(/^www\./, '')
			.toLowerCase()
		for (let i = remaining.length - 1; i >= 0; i--) {
			if (
				new URL(remaining[i].websiteUrl).hostname
					.replace(/^www\./, '')
					.toLowerCase() === advertiser
			) {
				remaining.splice(i, 1)
			}
		}
	}
	return chosen
}
export function selectAds(
	pool: Array<AdCampaign>,
	placement: AdPlacement,
	count: number,
	now: number,
	previous?: Selection,
	random = Math.random
): Selection {
	const eligible = pool.filter((ad) => eligibleAd(ad, placement, now))
	if (
		previous &&
		Number.isFinite(previous.selectedAt) &&
		previous.selectedAt <= now &&
		now - previous.selectedAt < SELECTION_TTL
	) {
		const ids = previous.ids
			.filter((id) => eligible.some((ad) => ad.id === id))
			.slice(0, count)
		// Preserve survivors; removal never keeps an ineligible campaign alive.
		return { ids, selectedAt: previous.selectedAt }
	}
	return {
		ids: weightedAds(
			eligible,
			count,
			placement === 'listing' ? previous?.ids : [],
			random
		).map((ad) => ad.id),
		selectedAt: now,
	}
}
export const selectionKey = (placement: AdPlacement) =>
	`altstack:ads:v1:${placement}`

export const DISPLAY_SLOTS = 45
export const listingPositions = { desktop: [3, 18, 33], mobile: [3, 15, 29] }
export function listingSlots<T>(
	items: Array<T>,
	ads: Array<AdCampaign>,
	mobile: boolean
) {
	const result: Array<{ item: T } | { ad: AdCampaign }> = []
	const positions = mobile ? listingPositions.mobile : listingPositions.desktop
	let index = 0
	for (let slot = 1; slot <= DISPLAY_SLOTS; slot++) {
		const adIndex = positions.indexOf(slot)
		const ad = adIndex < 0 ? undefined : ads[adIndex]
		if (ad && index < items.length) result.push({ ad })
		else if (index < items.length) result.push({ item: items[index++] })
		else break
	}
	return result
}

// Boundaries record content consumption, independent of advertiser availability.
export type PageLedger = Partial<Record<string, number>>
export function pageOffset(ledger: PageLedger, page: number) {
	if (page <= 1) return 0
	if (Number.isSafeInteger(ledger[page]) && ledger[page]! >= 0) {
		return ledger[page]!
	}
	const known =
		Object.keys(ledger)
			.map(Number)
			.filter((p) => p < page)
			.toSorted((a, b) => b - a)[0] ?? 1
	return (ledger[known] ?? 0) + (page - known) * DISPLAY_SLOTS
}
export function recordPage(
	ledger: PageLedger,
	page: number,
	offset: number,
	consumed: number
): PageLedger {
	const next = offset + consumed
	const updated: PageLedger = { ...ledger, [page]: offset, [page + 1]: next }
	if (ledger[page + 1] !== next) {
		for (const key of Object.keys(updated)) {
			if (Number(key) > page + 1) delete updated[key]
		}
	}
	return updated
}
export function ledgerKey(catalogue: string) {
	return `altstack:ads:pages:v1:${catalogue}`
}
export function catalogueOffset(catalogue: string, page: number) {
	if (typeof window === 'undefined') return (page - 1) * DISPLAY_SLOTS
	return pageOffset(readSession<PageLedger>(ledgerKey(catalogue), {}), page)
}
