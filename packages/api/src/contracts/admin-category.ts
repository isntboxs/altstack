import { openapi } from '@orpc/openapi'

import { baseContract } from '@altstack/api/contracts/base'

import {
	adminCreateCategoryInputSchema,
	adminCreateCategoryOutputSchema,
	adminGetCategoryByIdInputSchema,
	adminGetCategoryByIdOutputSchema,
	adminListCategoriesInputSchema,
	adminListCategoriesOutputSchema,
	adminRemoveCategoryInputSchema,
	adminRemoveCategoryOutputSchema,
	adminUpdateCategoryInputSchema,
	adminUpdateCategoryOutputSchema,
} from '@altstack/shared/schemas/admin-category'

export const adminCategoryContract = {
	list: baseContract
		.meta(
			openapi({
				path: '/admin/categories',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				summary: 'Admin list categories',
				description:
					'List all categories, published subtree counts, and all-status direct assignment counts.',
				tags: ['AdminCategories'],
				operationId: 'listAdminCategories',
			})
		)
		.input(adminListCategoriesInputSchema)
		.output(adminListCategoriesOutputSchema),
	getById: baseContract
		.meta(
			openapi({
				path: '/admin/categories/{id}',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				paramsStyles: { id: 'primitive' },
				summary: 'Admin get category by id',
				description:
					'Get a category, root-first ancestors, and all immediate children, including empty categories.',
				tags: ['AdminCategories'],
				operationId: 'getAdminCategoryById',
			})
		)
		.input(adminGetCategoryByIdInputSchema)
		.output(adminGetCategoryByIdOutputSchema),
	create: baseContract
		.meta(
			openapi({
				path: '/admin/categories',
				method: 'POST',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				summary: 'Admin create category',
				description:
					'Create a category at depth 1–3. A parent with direct project assignments cannot gain a child.',
				tags: ['AdminCategories'],
				operationId: 'createAdminCategory',
				successStatus: 201,
			})
		)
		.input(adminCreateCategoryInputSchema)
		.output(adminCreateCategoryOutputSchema),
	update: baseContract
		.meta(
			openapi({
				path: '/admin/categories/{id}',
				method: 'PATCH',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				paramsStyles: { id: 'primitive' },
				summary: 'Admin update category',
				description:
					'Partial update; parentId null makes a root. Rename/reparent preserves subtree path history and rejects path ownership conflicts.',
				tags: ['AdminCategories'],
				operationId: 'updateAdminCategory',
			})
		)
		.input(adminUpdateCategoryInputSchema)
		.output(adminUpdateCategoryOutputSchema),
	remove: baseContract
		.meta(
			openapi({
				path: '/admin/categories/{id}',
				method: 'DELETE',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				paramsStyles: { id: 'primitive' },
				summary: 'Admin remove category',
				description:
					'Delete an empty leaf and its paths. Children or any direct project assignments prevent deletion.',
				tags: ['AdminCategories'],
				operationId: 'removeAdminCategory',
			})
		)
		.input(adminRemoveCategoryInputSchema)
		.output(adminRemoveCategoryOutputSchema),
}
