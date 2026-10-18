import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const preparePublicContent = createServerFn({ method: 'POST' })
	.validator(
		z.object({
			slug: z.string().min(1).max(100),
			content: z.string().max(100 * 1024),
		})
	)
	.handler(async ({ data }) => {
		const { prepareContent } = await import('./prepare.server')
		return prepareContent(data)
	})
