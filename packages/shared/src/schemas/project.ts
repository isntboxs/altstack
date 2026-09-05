import limax from 'limax'
import { z } from 'zod'

const slugSchema = z
	.string()
	.nonempty()
	.max(100)
	.transform((value) => limax(value))
	.refine((value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), {
		message: 'Invalid slug format',
	})

const projectField = {
	id: z.uuid(),
	name: z.string(),
	slug: z.string(),
	tagline: z.string(),
	description: z.string(),
	logo: z.url(),
	repositoryUrl: z.url(),
	websiteUrl: z.url().nullable(),
	content: z.string().nullable(),
	status: z
		.enum(['draft', 'published', 'rejected', 'removed'])
		.default('published'),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
}

const githubField = {
	owner: z.string(),
	repo: z.string(),
	stars: z.number().int().nonnegative(),
	forks: z.number().int().nonnegative(),
	fetchedAt: z.coerce.date(),
}

export const getProjectBySlugInputSchema = z.object({
	slug: slugSchema,
})

export const getProjectBySlugOutputSchema = z.object({
	...projectField,
	github: z.object(githubField),
})

export const listProjectsInputSchema = z.object({
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(50).optional().default(12),
})

const listProjectItemSchema = z
	.object({
		...projectField,
		github: z.object(githubField),
	})
	.omit({ content: true })

const paginationOutputSchema = z.object({
	page: z.number().int().nonnegative(),
	limit: z.number().int().nonnegative(),
	totalItems: z.number().int().nonnegative(),
	totalPages: z.number().int().nonnegative(),
	hasNextPage: z.boolean(),
	hasPreviousPage: z.boolean(),
})

export const listProjectsOutputSchema = z.object({
	projects: z.array(listProjectItemSchema),
	pagination: paginationOutputSchema,
})

export const searchSortSchema = z.enum([
	'newest',
	'oldest',
	'name',
	'most-stars',
	'most-forks',
])

export const searchProjectsInputSchema = z.object({
	q: z
		.string()
		.trim()
		.optional()
		.transform((value) =>
			value === undefined || value === '' ? undefined : value
		),
	category: z.string().trim().min(1).max(100).optional(),
	sort: searchSortSchema.optional().default('newest'),
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(50).optional().default(12),
})

export const searchProjectsOutputSchema = z.object({
	projects: z.array(
		listProjectItemSchema.extend({ categories: z.array(z.string()) })
	),
	pagination: paginationOutputSchema,
})

export const categoryItemSchema = z.object({
	slug: z.string(),
	name: z.string(),
})

export const listCategoriesInputSchema = z.object({})

export const listCategoriesOutputSchema = z.object({
	categories: z.array(categoryItemSchema),
})
