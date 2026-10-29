import { stripSearchParams } from '@tanstack/react-router'
import { z } from 'zod'

export const collectionSearchSchema = z.object({
	page: z.coerce.number().int().min(1).max(100000).catch(1).default(1),
})

export const collectionSearchMiddlewares = [
	stripSearchParams<z.infer<typeof collectionSearchSchema>>({ page: 1 }),
]
