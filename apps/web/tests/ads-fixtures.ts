import type { AdCampaign } from '@altstack/shared/schemas/ads'
export const now = Date.UTC(2026, 10, 15)
export function campaign(
	id: string,
	tier: AdCampaign['tier'] = 'tier2'
): AdCampaign {
	return {
		id,
		name: `Test advertiser ${id}`,
		description: 'Synthetic campaign for automated tests.',
		websiteUrl: `https://${id}.example.test`,
		logo: `ads/${id}/logo.png`,
		banner: `ads/${id}/banner.png`,
		ctaText: 'Visit test website',
		buttonColor: '#2563eb',
		tier,
		status: 'active',
		startMonth: '2026-11',
		months: 1,
		startsAt: new Date(Date.UTC(2026, 10, 1)),
		endsAt: new Date(Date.UTC(2026, 11, 1)),
		version: 1,
		createdAt: new Date(0),
		updatedAt: new Date(0),
	}
}
