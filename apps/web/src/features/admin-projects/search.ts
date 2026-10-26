import { z } from 'zod'

import { PROJECT_STATUS } from '@altstack/shared/constants'

export const adminProjectSearchSchema = z.object({
	page: z.coerce.number().int().min(1).max(100_000).optional().catch(undefined),
	status: z
		.enum([...PROJECT_STATUS, 'needsReview'])
		.optional()
		.catch(undefined),
	name: z.string().trim().max(100).optional().catch(undefined),
	sort: z.enum(['name', 'createdAt']).optional().catch(undefined),
	order: z.enum(['asc', 'desc']).optional().catch(undefined),
})
export type AdminProjectSearch = z.infer<typeof adminProjectSearchSchema>
