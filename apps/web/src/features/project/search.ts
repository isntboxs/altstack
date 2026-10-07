import { z } from 'zod'

import {
	searchProjectsInputSchema,
	searchSortSchema,
} from '@altstack/shared/schemas/project'

export const projectFilterSearchSchema = searchProjectsInputSchema
	.pick({ q: true })
	.extend({
		q: searchProjectsInputSchema.shape.q.catch(undefined),
		sort: searchSortSchema.optional().catch('newest'),
		page: z.coerce.number().int().min(1).optional().catch(1),
	})

export const homeProjectSearchSchema = projectFilterSearchSchema.extend({
	category: searchProjectsInputSchema.shape.category.catch(undefined),
})
