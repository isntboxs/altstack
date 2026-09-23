import 'zod/compile'
import { z } from 'zod'

import { PROJECT_STATUS } from '@altstack/shared/constants'
import {
	paginationSchema,
	projectSchema,
} from '@altstack/shared/schemas/common'

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
