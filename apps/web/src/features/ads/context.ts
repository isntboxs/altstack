import type { Selection } from './selection'
import { createContext, useContext } from 'react'

import { eligibleAd } from '@altstack/shared/schemas/ads'
import type { AdCampaign, AdPlacement } from '@altstack/shared/schemas/ads'
export interface AdsContextValue {
	campaigns: Array<AdCampaign>
	selections: Partial<Record<AdPlacement, Selection>>
	now: number
	entry: string
}
export const emptyAds: AdsContextValue = {
	campaigns: [],
	selections: {},
	now: 0,
	entry: '',
}
export const AdsContext = createContext<AdsContextValue>(emptyAds)
export function useAds(placement: AdPlacement) {
	const context = useContext(AdsContext)
	const eligible = context.campaigns.filter((ad) =>
		eligibleAd(ad, placement, context.now)
	)
	if (placement === 'sponsors' || placement === 'corner') return eligible
	return (context.selections[placement]?.ids ?? []).flatMap((id) => {
		const ad = eligible.find((item) => item.id === id)
		return ad ? [ad] : []
	})
}
export function useAdsEntry() {
	return useContext(AdsContext).entry
}
