import 'zod/compile'
import { z } from 'zod'

import { categoryNodeSchema } from '@altstack/shared/schemas/category'
import { slugSchema } from '@altstack/shared/schemas/common'

export const adminCategoryNodeSchema = categoryNodeSchema.extend({
	directProjectCount: z.number().int().nonnegative(),
})
export type AdminCategoryNode = z.infer<typeof adminCategoryNodeSchema>

const categoryFields = z.object({
	name: z.string().trim().min(2).max(100),
	slug: slugSchema,
	description: z.string().trim().nonempty().max(300),
	parentId: z.uuid().nullable(),
})

export const adminListCategoriesInputSchema = z.object({})
export const adminListCategoriesOutputSchema = z.object({
	categories: z.array(adminCategoryNodeSchema),
})
export const adminCategoryParamsSchema = z.object({ id: z.uuid() })
export const adminGetCategoryByIdInputSchema = z.object({
	params: adminCategoryParamsSchema,
})
export const adminGetCategoryByIdOutputSchema = z.object({
	category: adminCategoryNodeSchema,
	ancestors: z.array(adminCategoryNodeSchema),
	children: z.array(adminCategoryNodeSchema),
})
export const adminCreateCategoryBodySchema = categoryFields
export const adminCreateCategoryInputSchema = z.object({
	body: adminCreateCategoryBodySchema,
})
export const adminCreateCategoryOutputSchema = adminCategoryNodeSchema
// Omitted description keeps legacy null; an explicit description must be nonempty.
export const adminUpdateCategoryBodySchema = categoryFields.partial()
export const adminUpdateCategoryInputSchema = z.object({
	params: adminCategoryParamsSchema,
	// A PATCH without a body remains a no-op.
	body: adminUpdateCategoryBodySchema.optional(),
})
export const adminUpdateCategoryOutputSchema = adminCategoryNodeSchema
export const adminRemoveCategoryInputSchema = z.object({
	params: adminCategoryParamsSchema,
})
export const adminRemoveCategoryOutputSchema = z.object({ id: z.uuid() })

export type AdminCreateCategoryBody = z.infer<
	typeof adminCreateCategoryBodySchema
>
export type AdminUpdateCategoryBody = z.infer<
	typeof adminUpdateCategoryBodySchema
>
export type AdminCategoryParams = z.infer<typeof adminCategoryParamsSchema>
export type AdminCreateCategoryInput = z.infer<
	typeof adminCreateCategoryInputSchema
>
export type AdminUpdateCategoryInput = z.infer<
	typeof adminUpdateCategoryInputSchema
>
