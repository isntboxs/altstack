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
