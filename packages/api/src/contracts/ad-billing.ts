import { z } from 'zod'

import {
	adAccessSchema,
	adCreativeSchema,
	adOrderViewSchema,
	adPlanSchema,
	adminAdOrderViewSchema,
} from '@altstack/shared/schemas/ad-billing'
import {
	requestLogoUploadBodySchema,
	requestLogoUploadOutputSchema,
	requestScreenshotUploadBodySchema,
	requestScreenshotUploadOutputSchema,
	logoKeySchema,
	screenshotKeySchema,
} from '@altstack/shared/schemas/upload'

import { baseContract, publicContract } from './base'

const access = z.object({ body: adAccessSchema })
const success = z.object({ success: z.literal(true) })
const managedUpload = (kind: 'logo' | 'banner') => {
	const key = kind === 'logo' ? logoKeySchema : screenshotKeySchema
	return {
		request: publicContract
			.input(
				z.object({
					body: adAccessSchema.extend(
						(kind === 'logo'
							? requestLogoUploadBodySchema
							: requestScreenshotUploadBodySchema
						).shape
					),
				})
			)
			.output(
				kind === 'logo'
					? requestLogoUploadOutputSchema
					: requestScreenshotUploadOutputSchema
			),
		remove: publicContract
			.input(z.object({ body: adAccessSchema.extend({ key }) }))
			.output(success),
		change: publicContract
			.input(
				z.object({ body: adAccessSchema.extend({ oldKey: key, newKey: key }) })
			)
			.output(success),
	}
}
export const adBillingContract = {
	config: publicContract
		.input(z.object({}))
		.output(
			z.object({ available: z.boolean(), contactEmail: z.email().nullable() })
		),
	create: publicContract
		.input(
			z.object({
				body: z.object({
					plan: adPlanSchema,
					email: z.email().max(254),
					termsAccepted: z.literal(true),
				}),
			})
		)
		.output(success),
	get: publicContract.input(access).output(adOrderViewSchema),
	submit: publicContract
		.input(
			z.object({
				body: adAccessSchema.extend({
					material: adCreativeSchema,
					expectedVersion: z.number().int().positive(),
				}),
			})
		)
		.output(adOrderViewSchema),
	requestRenewal: publicContract.input(access).output(adOrderViewSchema),
	requestAccess: publicContract
		.input(z.object({ body: z.object({ email: z.email().max(254) }) }))
		.output(success),
	upload: { logo: managedUpload('logo'), banner: managedUpload('banner') },
}
const adminAction = z.object({
	id: z.uuid(),
	expectedVersion: z.number().int().positive(),
})
export const adminAdBillingContract = {
	setStatus: baseContract
		.input(
			z.object({
				body: adminAction.extend({ status: z.enum(['active', 'inactive']) }),
			})
		)
		.output(adOrderViewSchema),
	list: baseContract
		.input(z.object({}))
		.output(z.array(adminAdOrderViewSchema)),
	confirmPayment: baseContract
		.input(
			z.object({
				body: adminAction.extend({
					kind: z.enum(['initial', 'renewal']),
					reference: z.string().trim().min(3).max(200),
				}),
			})
		)
		.output(adOrderViewSchema),
	review: baseContract
		.input(
			z.object({
				body: adminAction.extend({
					decision: z.enum(['approve', 'revise', 'reject']),
					reason: z.string().trim().max(1000).default(''),
					ctaText: z.string().trim().min(1).max(40).default('Visit website'),
					buttonColor: z
						.string()
						.regex(/^#[0-9a-fA-F]{6}$/)
						.default('#2563eb'),
				}),
			})
		)
		.output(adOrderViewSchema),
}
