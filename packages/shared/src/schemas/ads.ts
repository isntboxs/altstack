import { z } from 'zod'

export const campaignMonthSchema = z
	.string()
	.regex(/^\d{4}-(0[1-9]|1[0-2])$/)
	.refine(
		(value) => Number(value.slice(0, 4)) >= 2020,
		'Choose a month from 2020 onwards'
	)
const asset = z
	.string()
	.regex(
		/^(ads\/[0-9a-f-]{36}\/(logo|banner)-[0-9a-f-]{36}\.(png|jpg|webp|gif)|tmp\/(logos|screenshots)\/[a-z0-9-]+-[0-9]+\.(png|jpe?g|webp|gif))$/
	)
export const adBodySchema = z
	.object({
		name: z.string().trim().min(1).max(80),
		description: z.string().trim().min(1).max(180),
		websiteUrl: z
			.url()
			.max(2048)
			.refine((url) => /^https?:\/\//i.test(url), 'Use an HTTP or HTTPS URL'),
		logo: asset,
		banner: asset,
		ctaText: z.string().trim().min(1).max(40).default('Visit website'),
		buttonColor: z
			.string()
			.regex(/^#[0-9a-fA-F]{6}$/)
			.default('#2563eb'),
		tier: z.enum(['tier1', 'tier2', 'tier3']),
		status: z.enum(['draft', 'active', 'inactive']).default('draft'),
		startMonth: campaignMonthSchema,
		months: z.number().int().min(1).max(24).default(1),
	})
	.refine(
		(value) =>
			value.logo.startsWith('ads/') || value.logo.startsWith('tmp/logos/'),
		{ path: ['logo'], message: 'Choose a logo upload' }
	)
	.refine(
		(value) =>
			value.banner.startsWith('ads/') ||
			value.banner.startsWith('tmp/screenshots/'),
		{ path: ['banner'], message: 'Choose a banner upload' }
	)
export const adSchema = adBodySchema.safeExtend({
	id: z.uuid(),
	version: z.number().int().positive(),
	startsAt: z.coerce.date(),
	endsAt: z.coerce.date(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
})
export type AdCampaign = z.infer<typeof adSchema>
export type AdBody = z.infer<typeof adBodySchema>
export type AdPlacement =
	| 'banner'
	| 'listing'
	| 'collection-detail'
	| 'project-detail'
	| 'corner'
	| 'sponsors'

export function campaignPeriod(startMonth: string, months: number) {
	const [year = 0, month = 1] = startMonth.split('-').map(Number)
	return {
		startsAt: new Date(Date.UTC(year, month - 1, 1)),
		endsAt: new Date(Date.UTC(year, month - 1 + months, 1)),
	}
}
export function eligibleAd(
	ad: AdCampaign,
	placement: AdPlacement,
	now: number
) {
	return (
		ad.status === 'active' &&
		new Date(ad.startsAt).getTime() <= now &&
		now < new Date(ad.endsAt).getTime() &&
		(!['banner', 'project-detail', 'sponsors'].includes(placement) ||
			ad.tier !== 'tier1')
	)
}
export function ctaForeground(hex: string) {
	const channels = [1, 3, 5]
		.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
		.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
	const luminance =
		0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
	return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05)
		? '#000000'
		: '#ffffff'
}
