import { z } from 'zod'

import {
	tagLetterSchema,
	tagListQuerySchema,
	tagSortSchema,
} from '@altstack/shared/schemas/tag'

export const tagSearchSchema = z.object({
	q: tagListQuerySchema.shape.q.catch(undefined),
	letter: tagLetterSchema.optional().catch(undefined),
	sort: tagSortSchema.optional().catch(undefined),
	page: z.coerce.number().int().min(1).optional().catch(undefined),
})
