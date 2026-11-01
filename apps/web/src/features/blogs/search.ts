import { stripSearchParams } from '@tanstack/react-router'
import { z } from 'zod'

export const blogSearchSchema = z.object({
	page: z.coerce.number().int().min(1).max(100000).catch(1).default(1),
})

export const blogSearchMiddlewares = [
	stripSearchParams<z.infer<typeof blogSearchSchema>>({ page: 1 }),
]
