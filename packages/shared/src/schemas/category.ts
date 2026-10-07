import 'zod/compile'
import { z } from 'zod'

export const categoryNodeSchema = z.object({
	id: z.uuid(),
	parentId: z.uuid().nullable(),
	slug: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	path: z.string(),
	depth: z.number().int().min(1).max(3),
	isLeaf: z.boolean(),
	projectCount: z.number().int().nonnegative(),
})

export type CategoryNode = z.infer<typeof categoryNodeSchema>

export const listPublicCategoriesInputSchema = z.object({})
export const listPublicCategoriesOutputSchema = z.object({
	categories: z.array(categoryNodeSchema),
})

// Preserve the supplied path exactly: mismatched hierarchy paths must not be
// silently normalized to a different category or treated as a bare leaf slug.
export const getCategoryByPathQuerySchema = z.object({
	path: z.string().min(1),
})
export const getCategoryByPathInputSchema = z.object({
	query: getCategoryByPathQuerySchema,
})
export const getCategoryByPathOutputSchema = z.object({
	category: categoryNodeSchema,
	ancestors: z.array(categoryNodeSchema),
	children: z.array(categoryNodeSchema),
})
