import { openapi } from '@orpc/openapi'
import { z } from 'zod'

import { baseContract, publicContract } from '@altstack/api/contracts/base'

import { adBodySchema, adSchema } from '@altstack/shared/schemas/ads'

const id = z.object({ id: z.uuid() })
const revision = z.object({ expectedVersion: z.number().int().positive() })
const meta = (
	path: `/${string}`,
	method: 'QUERY' | 'POST' | 'PUT' | 'DELETE',
	operationId: string
) =>
	openapi({
		path,
		method,
		operationId,
		inputStructure: 'detailed',
		outputStructure: 'compact',
		tags: ['Ads'],
	})
export const adsContract = {
	list: publicContract
		.meta(meta('/ads', 'QUERY', 'listEligibleAds'))
		.input(z.object({}))
		.output(
			z.object({ campaigns: z.array(adSchema), serverNow: z.coerce.date() })
		),
}
export const adminAdsContract = {
	list: baseContract
		.meta(meta('/admin/ads', 'QUERY', 'listAdminAds'))
		.input(z.object({}))
		.output(z.array(adSchema)),
	create: baseContract
		.meta(meta('/admin/ads', 'POST', 'createAd'))
		.input(z.object({ body: adBodySchema }))
		.output(adSchema),
	update: baseContract
		.meta(meta('/admin/ads/{id}', 'PUT', 'updateAd'))
		.input(
			z.object({ params: id, body: adBodySchema.safeExtend(revision.shape) })
		)
		.output(adSchema),
	delete: baseContract
		.meta(meta('/admin/ads/{id}', 'DELETE', 'deleteAd'))
		.input(z.object({ params: id, body: revision }))
		.output(z.object({ success: z.literal(true) })),
}
