import 'zod/compile'
import { z } from 'zod'

import { PROJECT_STATUS } from '@altstack/shared/constants'
import {
	paginationSchema,
	projectSchema,
	repositoryUrlSchema,
	slugSchema,
} from '@altstack/shared/schemas/common'
import { githubDetailSchema } from '@altstack/shared/schemas/project'
import {
	logoKeySchema,
	screenshotKeySchema,
} from '@altstack/shared/schemas/upload'

// Validate the number of distinct direct assignments after trimming/deduplication.
const categorySlugsSchema = z
	.array(z.string().trim().min(1).max(100))
	.transform((slugs) => [...new Set(slugs)])
	.pipe(z.array(z.string()).max(3))

const nullableCopy = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullable()
		.transform((value) => (value === '' ? null : value))

// Publish checks the complete merged record, including existing final media.
export const publishProjectSchema = z.object({
	name: z.string().trim().min(2).max(100),
	slug: slugSchema,
	repositoryUrl: repositoryUrlSchema,
	tagline: z.string().trim().min(1, 'Tagline is required to publish').max(100),
	description: z
		.string()
		.trim()
		.min(1, 'Description is required to publish')
		.max(300),
	logo: z.string().trim().min(1, 'Logo is required to publish'),
	categorySlugs: categorySlugsSchema.pipe(
		z.array(z.string()).min(1, 'Choose 1–3 leaf categories to publish')
	),
})

export const adminProjectSchema = projectSchema.extend({
	tagline: z.string().nullable(),
	description: z.string().nullable(),
	logo: z.string().nullable(),
	submitterId: z.uuid().nullable(),
	submitter: z
		.object({
			id: z.uuid(),
			name: z.string(),
			email: z.string(),
			image: z.string().nullable(),
		})
		.nullable(),
	rejectionReason: z.string().nullable(),
})

export const adminProjectParamsSchema = z.object({ id: z.uuid() })

export const adminCreateProjectBodySchema = z.object({
	name: z.string().trim().min(2).max(100),
	slug: slugSchema,
	repositoryUrl: repositoryUrlSchema,
	tagline: nullableCopy(100).optional(),
	description: nullableCopy(300).optional(),
	logo: logoKeySchema.nullable().optional(),
	screenshot: screenshotKeySchema.optional(),
	websiteUrl: z.url({ protocol: /^https?$/ }).optional(),
	content: z
		.string()
		.trim()
		.optional()
		.transform((v) => v ?? undefined),
	categorySlugs: categorySlugsSchema.default([]),
	// Visibility at creation. Drafts stay hidden from the public catalogue
	// (`status = 'published'` filter); omitted input defaults to
	// 'published' to preserve the pre-status behaviour. The admin UI offers
	// draft/published; the API accepts the full PROJECT_STATUS enum.
	status: z.enum(PROJECT_STATUS).optional().default('published'),
})

export const adminCreateProjectInputSchema = z.object({
	body: adminCreateProjectBodySchema,
})

export const adminCreateProjectOutputSchema = adminProjectSchema.extend({
	github: githubDetailSchema,
})

export const adminListProjectQuerySchema = z.object({
	status: z.enum(PROJECT_STATUS).optional(),
	// HTTP query strings must preserve false instead of Boolean('false').
	needsReview: z
		.union([
			z.boolean(),
			z.enum(['true', 'false']).transform((v) => v === 'true'),
		])
		.optional(),
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
		adminProjectSchema.extend({
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
	tagline: nullableCopy(100).optional(),
	description: nullableCopy(300).optional(),
	logo: logoKeySchema.nullable().optional(),
	screenshot: screenshotKeySchema.nullable().optional(),
	websiteUrl: z
		.url({ protocol: /^https?$/ })
		.nullable()
		.optional(),
	content: z.string().trim().nullable().optional(),
	categorySlugs: categorySlugsSchema.optional(),
	status: z.enum(PROJECT_STATUS).optional(),
	rejectionReason: z
		.string()
		.trim()
		.max(1000)
		.nullable()
		.transform((value) => (value === '' ? null : value))
		.optional(),
})

export const adminUpdateProjectInputSchema = z.object({
	params: adminProjectParamsSchema,
	// A PATCH without a body remains a no-op.
	body: adminUpdateProjectBodySchema.optional(),
})

export const adminUpdateProjectOutputSchema = adminProjectSchema.extend({
	github: githubDetailSchema,
})

export const adminGithubRefreshInputSchema = z.object({
	params: adminProjectParamsSchema,
})

export const adminGithubRefreshOutputSchema = z.object({
	repositoryUrl: repositoryUrlSchema,
	github: githubDetailSchema,
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

export const adminGithubMetadataInputSchema = z.object({
	repositoryUrl: repositoryUrlSchema,
})

export const adminGithubReadmeInputSchema = z.object({
	repositoryUrl: repositoryUrlSchema,
})

export const adminGithubReadmeOutputSchema = z.object({
	repositoryUrl: repositoryUrlSchema,
	sourceUrl: z.url({ protocol: /^https$/ }),
	path: z.string().min(1),
	commitSha: z.string().regex(/^[a-f0-9]{40}$/i),
	markdown: z.string().min(1),
	warnings: z.array(z.string()),
})

export const adminGithubMetadataOutputSchema = z.object({
	repositoryUrl: repositoryUrlSchema,
	// Keep long upstream copy intact so the admin can correct it in the preview.
	description: z.string().nullable(),
	websiteUrl: z.url({ protocol: /^https?$/ }).nullable(),
})

export const adminProjectReviewActionSchema = z.enum([
	'project_created',
	'project_submitted',
	'project_status_changed',
])

export const adminProjectReviewHistoryQuerySchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(50).default(20),
})

export const adminProjectReviewHistoryInputSchema = z.object({
	params: adminProjectParamsSchema,
	query: adminProjectReviewHistoryQuerySchema,
})

export const adminProjectReviewHistoryOutputSchema = z.object({
	events: z.array(
		z.object({
			id: z.uuid(),
			action: adminProjectReviewActionSchema,
			createdAt: z.coerce.date(),
			actor: z.object({ id: z.uuid(), name: z.string() }).nullable(),
			reason: z.string().nullable(),
			fromStatus: z.enum(PROJECT_STATUS).nullable(),
			toStatus: z.enum(PROJECT_STATUS).nullable(),
		})
	),
	pagination: paginationSchema,
})
