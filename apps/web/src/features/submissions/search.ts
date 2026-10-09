import { z } from 'zod'

export const submissionSearchSchema = z.object({
	// Preserve spaces while typing; the API trims the search term for matching.
	q: z.string().max(100).catch('').optional(),
	page: z.number().int().min(1).catch(1).optional(),
	limit: z
		.number()
		.refine((value) => [10, 25, 50].includes(value))
		.catch(25)
		.optional(),
})
