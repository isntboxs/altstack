import { openapi } from '@orpc/openapi'
import { z } from 'zod'

import { baseContract, publicContract } from '@altstack/api/contracts/base'

import {
	adminCreateTagInputSchema,
	adminListTagsOutputSchema,
	adminTagBodySchema,
	adminUpdateTagInputSchema,
	getTagInputSchema,
	getTagOutputSchema,
	listTagsInputSchema,
	listTagsOutputSchema,
	tagIdParamsSchema,
	tagSchema,
} from '@altstack/shared/schemas/tag'

export const tagContract = {
	list: publicContract
		.meta(
			openapi({
				path: '/tags',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				queryStyles: {
					q: 'primitive',
					letter: 'primitive',
					sort: 'primitive',
					page: 'primitive',
					limit: 'primitive',
				},
				tags: ['Tags'],
				operationId: 'listTags',
				summary: 'Browse tags used by published projects',
			})
		)
		.input(listTagsInputSchema)
		.output(listTagsOutputSchema),
	getBySlug: publicContract
		.meta(
			openapi({
				path: '/tags/{slug}',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				tags: ['Tags'],
				operationId: 'getTag',
				summary: 'Get a public tag',
			})
		)
		.input(getTagInputSchema)
		.output(getTagOutputSchema),
}
const adminTagOutput = tagSchema.extend(adminTagBodySchema.shape)
export const adminTagContract = {
	list: baseContract
		.meta(
			openapi({
				path: '/admin/tags',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				queryStyles: {
					q: 'primitive',
					letter: 'primitive',
					sort: 'primitive',
					page: 'primitive',
					limit: 'primitive',
				},
				tags: ['AdminTags'],
				operationId: 'listAdminTags',
				summary: 'List all tags, including hidden and unused tags',
			})
		)
		.input(listTagsInputSchema)
		.output(adminListTagsOutputSchema),
	create: baseContract
		.meta(
			openapi({
				path: '/admin/tags',
				method: 'POST',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				tags: ['AdminTags'],
				operationId: 'createTag',
				summary: 'Create a GitHub topic tag',
			})
		)
		.input(adminCreateTagInputSchema)
		.output(adminTagOutput),
	update: baseContract
		.meta(
			openapi({
				path: '/admin/tags/{id}',
				method: 'PATCH',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				tags: ['AdminTags'],
				operationId: 'updateTag',
				summary: 'Curate tag display and visibility',
			})
		)
		.input(adminUpdateTagInputSchema)
		.output(adminTagOutput),
	remove: baseContract
		.meta(
			openapi({
				path: '/admin/tags/{id}',
				method: 'DELETE',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				tags: ['AdminTags'],
				operationId: 'deleteTag',
				summary: 'Delete an unused tag',
			})
		)
		.input(tagIdParamsSchema)
		.output(z.object({ success: z.literal(true) })),
}
