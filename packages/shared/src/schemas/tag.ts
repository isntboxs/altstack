import 'zod/compile'
import { z } from 'zod'

export const tagSlugSchema = z
	.string()
	.trim()
	.toLowerCase()
	.regex(
		/^[a-z0-9][a-z0-9-]{0,49}$/,
		'Use up to 50 lowercase letters, numbers, or hyphens.'
	)
export const githubTopicsSchema = z.array(tagSlugSchema).max(20)
export const tagSchema = z.object({
	id: z.uuid(),
	slug: tagSlugSchema,
	name: z.string(),
	description: z.string().nullable(),
})
export const tagSortSchema = z.enum(['popular', 'name-asc', 'name-desc'])
export const tagLetterSchema = z.string().regex(/^[A-Z&]$/)
export const tagListQuerySchema = z.object({
	q: z.string().trim().max(100).optional(),
	letter: tagLetterSchema.optional(),
	sort: tagSortSchema.default('popular'),
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(100).default(60),
})
export const tagCountSchema = tagSchema.extend({
	projectCount: z.number().int().nonnegative(),
})
export const tagPaginationSchema = z.object({
	page: z.number().int().positive(),
	limit: z.number().int().positive(),
	totalItems: z.number().int().nonnegative(),
	totalPages: z.number().int().nonnegative(),
	hasNextPage: z.boolean(),
	hasPreviousPage: z.boolean(),
})
export const listTagsInputSchema = z.object({ query: tagListQuerySchema })
export const listTagsOutputSchema = z.object({
	tags: z.array(tagCountSchema),
	pagination: tagPaginationSchema,
})
export const getTagInputSchema = z.object({
	params: z.object({ slug: tagSlugSchema }),
})
export const getTagOutputSchema = z.object({ tag: tagCountSchema })
export const adminTagSchema = tagCountSchema.extend({
	hidden: z.boolean(),
	assignmentCount: z.number().int().nonnegative(),
})
export const adminTagBodySchema = z.object({
	name: z.string().trim().min(1).max(100),
	description: z.string().trim().max(1000).nullable().default(null),
	hidden: z.boolean().default(false),
})
export const adminCreateTagInputSchema = z.object({
	body: adminTagBodySchema.extend({ slug: tagSlugSchema }),
})
export const tagIdParamsSchema = z.object({
	params: z.object({ id: z.uuid() }),
})
export const adminUpdateTagInputSchema = tagIdParamsSchema.extend({
	body: adminTagBodySchema,
})
export const adminListTagsOutputSchema = z.object({
	tags: z.array(adminTagSchema),
	pagination: tagPaginationSchema,
})
