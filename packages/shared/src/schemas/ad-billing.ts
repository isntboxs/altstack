import { z } from 'zod'

import { adBodySchema } from './ads'

export const adPlanSchema = z.enum(['core', 'plus', 'priority'])
export type AdPlan = z.infer<typeof adPlanSchema>
export const AD_PLANS = {
	core: {
		name: 'Core',
		paymentUrl: 'https://ko-fi.com/c/04c3fc24d3',
		amount: 1500,
		tier: 'tier1',
		description:
			'Listing cards, collection sidebar, and corner recommendation.',
	},
	plus: {
		name: 'Plus',
		paymentUrl: 'https://ko-fi.com/c/3da9b0e0d6',
		amount: 2900,
		tier: 'tier2',
		description:
			'All Core placements, public banner, project sidebar, and homepage sponsor grid.',
	},
	priority: {
		name: 'Priority',
		paymentUrl: 'https://ko-fi.com/c/e8bd0eb73f',
		amount: 5500,
		tier: 'tier3',
		description: 'All Plus placements with twice the selection weight.',
	},
} as const
export const adCreativeSchema = z
	.object({
		name: adBodySchema.shape.name,
		description: adBodySchema.shape.description,
		websiteUrl: adBodySchema.shape.websiteUrl,
		logo: adBodySchema.shape.logo,
		banner: adBodySchema.shape.banner,
	})
	.refine(
		(value) =>
			value.logo.startsWith('ads/') || value.logo.startsWith('tmp/logos/'),
		{ path: ['logo'], message: 'Choose a logo upload' }
	)
export type AdCreative = z.infer<typeof adCreativeSchema>
export const adOrderStatusSchema = z.enum([
	'pending_payment',
	'awaiting_materials',
	'in_review',
	'changes_requested',
	'approved',
	'rejected',
])
export const adAccessSchema = z.object({
	id: z.uuid(),
	token: z.string().min(40).max(512),
})
export type AdAccess = z.infer<typeof adAccessSchema>
export const adOrderViewSchema = z.object({
	id: z.uuid(),
	plan: adPlanSchema,
	amount: z.number().int().positive(),
	currency: z.literal('usd'),
	status: adOrderStatusSchema,
	email: z.email(),
	material: adCreativeSchema.nullable(),
	feedback: z.string().nullable(),
	paidAt: z.coerce.date().nullable(),
	startsAt: z.coerce.date().nullable(),
	paidThrough: z.coerce.date().nullable(),
	renewalRequestedAt: z.coerce.date().nullable(),
	campaignId: z.uuid().nullable(),
	version: z.number().int().positive(),
	createdAt: z.coerce.date(),
})
export type AdOrderView = z.infer<typeof adOrderViewSchema>
export const adPaymentViewSchema = z.object({
	id: z.uuid(),
	kind: z.enum(['initial', 'renewal']),
	amount: z.number().int(),
	reference: z.string(),
	confirmedBy: z.string().nullable(),
	createdAt: z.coerce.date(),
})
export const adminAdOrderViewSchema = adOrderViewSchema.extend({
	payments: z.array(adPaymentViewSchema),
})

// A paid month preserves the UTC start time and clamps the day in shorter months.
export function nextAdMonth(start: Date) {
	const end = new Date(start)
	const day = end.getUTCDate()
	end.setUTCDate(1)
	end.setUTCMonth(end.getUTCMonth() + 1)
	const last = new Date(
		Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)
	).getUTCDate()
	end.setUTCDate(Math.min(day, last))
	return end
}
