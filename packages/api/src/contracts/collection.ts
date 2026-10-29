import { openapi } from '@orpc/openapi'
import { z } from 'zod'

import { baseContract, publicContract } from '@altstack/api/contracts/base'

import {
	adminCollectionSchema,
	collectionBodySchema,
	collectionCardSchema,
	collectionDetailSchema,
	collectionIdInput,
	collectionRevisionInput,
	collectionSlugSchema,
} from '@altstack/shared/schemas'

const page = z.object({
	query: z.object({
		page: z.coerce.number().int().min(1).max(100000).default(1),
		limit: z.coerce.number().int().min(1).max(50).default(12),
	}),
})
function meta(
	path: `/${string}`,
	method: 'QUERY' | 'POST' | 'PUT' | 'DELETE',
	operationId: string
) {
	return openapi({
		path,
		method,
		inputStructure: 'detailed',
		outputStructure: 'compact',
		operationId,
		tags: ['Collections'],
	})
}
export const collectionContract = {
	list: publicContract
		.meta(meta('/collections', 'QUERY', 'listCollections'))
		.input(page)
		.output(
			z.object({
				collections: z.array(collectionCardSchema),
				total: z.number().int(),
			})
		),
	getBySlug: publicContract
		.meta(meta('/collections/{slug}', 'QUERY', 'getCollection'))
		.input(z.object({ params: z.object({ slug: collectionSlugSchema }) }))
		.output(collectionDetailSchema),
}
export const adminCollectionContract = {
	list: baseContract
		.meta(meta('/admin/collections', 'QUERY', 'listAdminCollections'))
		.input(page)
		.output(
			z.object({
				collections: z.array(
					adminCollectionSchema.omit({ projects: true, mainProject: true })
				),
				total: z.number().int(),
			})
		),
	getById: baseContract
		.meta(meta('/admin/collections/{id}', 'QUERY', 'getAdminCollection'))
		.input(collectionIdInput)
		.output(adminCollectionSchema),
	create: baseContract
		.meta(meta('/admin/collections', 'POST', 'createCollection'))
		.input(z.object({ body: collectionBodySchema }))
		.output(adminCollectionSchema),
	update: baseContract
		.meta(meta('/admin/collections/{id}', 'PUT', 'updateCollection'))
		.input(
			collectionRevisionInput.extend({
				body: collectionBodySchema.safeExtend({
					expectedVersion: z.number().int().positive(),
				}),
			})
		)
		.output(adminCollectionSchema),
	delete: baseContract
		.meta(meta('/admin/collections/{id}', 'DELETE', 'deleteCollection'))
		.input(collectionRevisionInput)
		.output(z.object({ success: z.literal(true) })),
}
