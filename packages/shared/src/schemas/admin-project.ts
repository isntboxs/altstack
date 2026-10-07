import 'zod/compile'
import { z } from 'zod'

import { PROJECT_STATUS } from '@altstack/shared/constants'
import {
	paginationSchema,
	projectSchema,
	repositoryUrlSchema,
	slugSchema,
} from '@altstack/shared/schemas/common'
import {
	logoKeySchema,
	screenshotKeySchema,
} from '@altstack/shared/schemas/upload'

// Validate the number of distinct direct assignments after trimming/deduplication.
const categorySlugsSchema = z
	.array(z.string().trim().min(1).max(100))
	.transform((slugs) => [...new Set(slugs)])
	.pipe(z.array(z.string()).min(1).max(3))

export const adminProjectParamsSchema = z.object({ id: z.uuid() })

export const adminCreateProjectBodySchema = z.object({
	name: z.string().trim().min(2).max(100),
	slug: slugSchema,
	repositoryUrl: repositoryUrlSchema,
	tagline: z.string().trim().nonempty().max(100),
	description: z.string().trim().nonempty().max(300),
	logo: logoKeySchema,
	screenshot: screenshotKeySchema.optional(),
	websiteUrl: z.url({ protocol: /^https?$/ }).optional(),
	content: z
		.string()
		.trim()
		.optional()
		.transform((v) => v ?? undefined),
	categorySlugs: categorySlugsSchema,
	// Visibility at creation. Drafts stay hidden from the public catalogue
	// (`status = 'published'` filter); omitted input defaults to
	// 'published' to preserve the pre-status behaviour. The admin UI offers
	// draft/published; the API accepts the full PROJECT_STATUS enum.
	status: z.enum(PROJECT_STATUS).optional().default('published'),
})

export const adminCreateProjectInputSchema = z.object({
	body: adminCreateProjectBodySchema,
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

export const adminListProjectQuerySchema = z.object({
	status: z.enum(PROJECT_STATUS).optional(),
	name: z.string().optional(),
	sort: z.enum(['name', 'createdAt']).optional().default('createdAt'),
	order: z.enum(['asc', 'desc']).optional().default('desc'),
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(50).optional().default(12),
})

export const adminListProjectInputSchema = z.object({
	query: adminListProjectQuerySchema,
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

// Partial update: every body field is optional. Image fields accept
// tmp/* keys only — omit to keep the current image, pass a new tmp key to
// replace it. `screenshot: null` removes the screenshot.
export const adminUpdateProjectBodySchema = z.object({
	name: z.string().trim().min(2).max(100).optional(),
	slug: slugSchema.optional(),
	repositoryUrl: repositoryUrlSchema.optional(),
	tagline: z.string().trim().nonempty().max(100).optional(),
	description: z.string().trim().nonempty().max(300).optional(),
	logo: logoKeySchema.optional(),
	screenshot: screenshotKeySchema.nullable().optional(),
	websiteUrl: z
		.url({ protocol: /^https?$/ })
		.nullable()
		.optional(),
	content: z.string().trim().nullable().optional(),
	categorySlugs: categorySlugsSchema.optional(),
	status: z.enum(PROJECT_STATUS).optional(),
})

export const adminUpdateProjectInputSchema = z.object({
	params: adminProjectParamsSchema,
	// A PATCH without a body remains a no-op.
	body: adminUpdateProjectBodySchema.optional(),
})

export const adminUpdateProjectOutputSchema = projectSchema.extend({
	github: z.object({
		owner: z.string(),
		repo: z.string(),
		stars: z.number().int().nonnegative(),
		forks: z.number().int().nonnegative(),
		fetchedAt: z.coerce.date(),
	}),
})

export const adminDeleteProjectInputSchema = z.object({
	params: adminProjectParamsSchema,
})

export const adminDeleteProjectOutputSchema = z.object({
	success: z.literal(true),
})

export const adminGetProjectByIdInputSchema = z.object({
	params: adminProjectParamsSchema,
})
