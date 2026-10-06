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
export const adminGetCategoryByIdInputSchema = z.object({ id: z.uuid() })
export const adminGetCategoryByIdOutputSchema = z.object({
	category: adminCategoryNodeSchema,
	ancestors: z.array(adminCategoryNodeSchema),
	children: z.array(adminCategoryNodeSchema),
})
export const adminCreateCategoryInputSchema = categoryFields
export const adminCreateCategoryOutputSchema = adminCategoryNodeSchema
// Omitted description keeps legacy null; an explicit description must be nonempty.
export const adminUpdateCategoryInputSchema = categoryFields.partial().extend({
	id: z.uuid(),
})
export const adminUpdateCategoryOutputSchema = adminCategoryNodeSchema
export const adminRemoveCategoryInputSchema = z.object({ id: z.uuid() })
export const adminRemoveCategoryOutputSchema = z.object({ id: z.uuid() })

export type AdminCreateCategoryInput = z.infer<
	typeof adminCreateCategoryInputSchema
>
export type AdminUpdateCategoryInput = z.infer<
	typeof adminUpdateCategoryInputSchema
>
