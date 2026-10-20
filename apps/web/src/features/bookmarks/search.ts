import { z } from 'zod'

export const bookmarkSearchSchema = z.object({
	page: z.number().int().min(1).max(1_000_000).catch(1).optional(),
	limit: z
		.number()
		.refine((value) => [10, 25, 50].includes(value))
		.catch(25)
		.optional(),
})
