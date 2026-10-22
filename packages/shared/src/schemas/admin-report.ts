import { z } from 'zod'

import { PROJECT_STATUS } from '@altstack/shared/constants'
import {
	reportStatusSchema,
	reportTypeSchema,
} from '@altstack/shared/schemas/report'

export const adminListReportsQuerySchema = z
	.object({
		status: z.enum(['open', 'resolved', 'dismissed', 'all']).default('open'),
		limit: z.coerce.number().int().min(1).max(50).default(12),
		// The immutable report ID anchors the exact database timestamp, including
		// sub-millisecond precision. Moderating the anchor does not invalidate it.
		cursor: z.uuid().optional(),
	})
	.strict()

export const adminListReportsInputSchema = z.object({
	query: adminListReportsQuerySchema,
})

export const adminListReportsOutputSchema = z.object({
	reports: z.array(
		z.object({
			id: z.uuid(),
			email: z.string(),
			type: reportTypeSchema,
			message: z.string(),
			createdAt: z.coerce.date(),
			status: reportStatusSchema,
			// LEFT JOIN: unpublished projects remain editable; deleted ones have no link.
			project: z
				.object({
					id: z.uuid(),
					name: z.string(),
					logo: z.string().nullable(),
					status: z.enum(PROJECT_STATUS),
				})
				.nullable(),
		})
	),
	nextCursor: z.uuid().nullable(),
})

export const adminModerateReportInputSchema = z.object({
	params: z.object({ id: z.uuid() }).strict(),
	body: z.object({ status: z.enum(['resolved', 'dismissed']) }).strict(),
})

export const adminModerateReportOutputSchema = z.object({
	id: z.uuid(),
	status: z.enum(['resolved', 'dismissed']),
})
