import { z } from 'zod'

import {
	searchProjectsQuerySchema,
	searchSortSchema,
} from '@altstack/shared/schemas/project'

export const projectFilterSearchSchema = searchProjectsQuerySchema
	.pick({ q: true })
	.extend({
		q: searchProjectsQuerySchema.shape.q.catch(undefined),
		sort: searchSortSchema.optional().catch('newest'),
		page: z.coerce.number().int().min(1).optional().catch(1),
	})

export const homeProjectSearchSchema = projectFilterSearchSchema.extend({
	category: searchProjectsQuerySchema.shape.category.catch(undefined),
})
