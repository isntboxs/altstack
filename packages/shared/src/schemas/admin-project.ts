import 'zod/compile'
import { z } from 'zod'

import { PROJECT_STATUS } from '@altstack/shared/constants'
import {
	paginationSchema,
	projectSchema,
	repositoryUrlSchema,
	slugSchema,
} from '@altstack/shared/schemas/common'

export const adminCreateProjectInputSchema = z.object({
	name: z.string().trim().min(2).max(100),
	slug: slugSchema,
	repositoryUrl: repositoryUrlSchema,
	tagline: z.string().trim().nonempty().max(100),
	description: z.string().trim().nonempty().max(300),
	logo: z.url(),
	websiteUrl: z.url({ protocol: /^https?$/ }).optional(),
	content: z
		.string()
		.trim()
		.optional()
		.transform((v) => v ?? undefined),
	categorySlugs: z.array(z.string().trim().min(1).max(100)).min(1).max(3),
})

export const adminCreateProjectOutputSchema = projectSchema.extend({
	github: z.object({
		owner: z.string(),
		repo: z.string(),
		stars: z.number().int().nonnegative(),
		forks: z.number().int().nonnegative(),
		fetchedAt: z.coerce.date(),
	}),
})

export const adminListProjectInputSchema = z.object({
	status: z.enum(PROJECT_STATUS).optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(50).optional().default(12),
})

export const adminListProjectOutputSchema = z.object({
	projects: z.array(
		projectSchema.extend({
			github: z.object({
				owner: z.string(),
				repo: z.string(),
				stars: z.number().int().nonnegative(),
				forks: z.number().int().nonnegative(),
				fetchedAt: z.coerce.date(),
			}),
		})
	),
	pagination: paginationSchema,
})
