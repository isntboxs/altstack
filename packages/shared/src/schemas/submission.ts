import { z } from 'zod'

import { PROJECT_STATUS } from '@altstack/shared/constants'
import {
	paginationSchema,
	repositoryUrlSchema,
} from '@altstack/shared/schemas/common'

export const createSubmissionInputSchema = z.object({
	name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
	repositoryUrl: repositoryUrlSchema,
	websiteUrl: z
		.string()
		.trim()
		.optional()
		.transform((value) => (value === '' ? undefined : value))
		.pipe(
			z
				.url({
					protocol: /^https?$/,
					error: 'Enter an HTTP or HTTPS website URL',
				})
				.optional()
		),
})

export const createSubmissionOutputSchema = z.object({
	id: z.uuid(),
	status: z.literal('draft'),
})

// Opaque PostgreSQL row revision, returned by the private prefill read. It is
// required so an edit prepared before a new review cannot overwrite that review.
const submissionRevisionSchema = z.string().regex(/^\d+$/).max(10)
export const getSubmissionInputSchema = z.object({
	params: z.object({ id: z.uuid() }).strict(),
})
export const getSubmissionOutputSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	repositoryUrl: z.url(),
	websiteUrl: z.string().nullable(),
	status: z.literal('rejected'),
	rejectionReason: z.string().nullable(),
	revision: submissionRevisionSchema,
})
export const resubmitSubmissionBodySchema = createSubmissionInputSchema
	.extend({ revision: submissionRevisionSchema })
	.strict()
export const resubmitSubmissionInputSchema = getSubmissionInputSchema.extend({
	body: resubmitSubmissionBodySchema,
})
export const resubmitSubmissionOutputSchema = createSubmissionOutputSchema

export const submissionRateLimitDataSchema = z.object({
	limit: z.number().int().positive(),
	remaining: z.number().int().nonnegative(),
	// oRPC and Upstash both use an epoch timestamp in milliseconds.
	reset: z.number().int().positive(),
})

export const listSubmissionQuerySchema = z.object({
	q: z.string().trim().max(100).optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(50).optional().default(25),
})

export const listSubmissionInputSchema = z.object({
	query: listSubmissionQuerySchema,
})

// An owner's overview is separate from the admin moderation response. Only
// listing information and the owner's review outcome are returned.
export const submissionListItemSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	slug: z.string(),
	logo: z.string().nullable(),
	repositoryUrl: z.url(),
	status: z.enum(PROJECT_STATUS),
	rejectionReason: z.string().nullable(),
	createdAt: z.coerce.date(),
})

export const listSubmissionOutputSchema = z.object({
	submissions: z.array(submissionListItemSchema),
	pagination: paginationSchema,
})
