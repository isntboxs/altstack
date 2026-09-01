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

export const listProjectsOutputSchema = z.object({
	projects: z.array(
		z
			.object({
				...projectField,
				github: z.object(githubField),
			})
			.omit({ content: true })
	),
	pagination: z.object({
		page: z.number().int().nonnegative(),
		limit: z.number().int().nonnegative(),
		totalItems: z.number().int().nonnegative(),
		totalPages: z.number().int().nonnegative(),
		hasNextPage: z.boolean(),
		hasPreviousPage: z.boolean(),
	}),
})
