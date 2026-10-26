import { z } from 'zod'

import { adminActivityQuerySchema } from '@altstack/shared/schemas/admin-dashboard'

const fields = adminActivityQuerySchema.shape
export const adminActivitySearchSchema = z
	.object({
		page: fields.page.catch(1),
		action: fields.action.catch(undefined),
		actorId: fields.actorId.catch(undefined),
		projectId: fields.projectId.catch(undefined),
		from: fields.from.catch(undefined),
		to: fields.to.catch(undefined),
	})
	.transform((query) => {
		return {
			...query,
			to:
				query.from && query.to && query.from > query.to ? undefined : query.to,
		}
	})

export const adminOwnershipSearchSchema = z.object({
	page: z.coerce.number().int().min(1).max(100_000).optional().catch(undefined),
	claimId: z.uuid().optional().catch(undefined),
})

export const adminReportSearchSchema = z.object({
	status: z
		.enum(['open', 'resolved', 'dismissed', 'all'])
		.optional()
		.catch(undefined),
	cursor: z.uuid().optional().catch(undefined),
	trail: z.array(z.uuid().nullable()).max(1000).optional().catch(undefined),
	reportId: z.uuid().optional().catch(undefined),
})
