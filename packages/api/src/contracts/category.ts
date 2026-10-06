import { openapi } from '@orpc/openapi'

import { publicContract } from '@altstack/api/contracts/base'

import {
	getCategoryByPathInputSchema,
	getCategoryByPathOutputSchema,
	listPublicCategoriesInputSchema,
	listPublicCategoriesOutputSchema,
} from '@altstack/shared/schemas/category'

export const categoryContract = {
	list: publicContract
		.meta(
			openapi({
				path: '/categories',
				method: 'GET',
				summary: 'List public categories',
				description:
					'List categories with published projects in their subtree, ordered by name.',
				tags: ['Categories'],
				operationId: 'listPublicCategories',
			})
		)
		.input(listPublicCategoriesInputSchema)
		.output(listPublicCategoriesOutputSchema),
	getByPath: publicContract
		.meta(
			openapi({
				path: '/categories/by-path',
				method: 'GET',
				summary: 'Get category by path',
				description:
					'Resolve a current or historical path to its category, current ancestors, and immediate public children.',
				tags: ['Categories'],
				operationId: 'getCategoryByPath',
			})
		)
		.input(getCategoryByPathInputSchema)
		.output(getCategoryByPathOutputSchema),
}
