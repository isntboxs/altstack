import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { emptyPublicContent } from '#/features/public-content/model'

export const preparePublicContent = createServerFn({ method: 'POST' })
	.validator(z.object({ slug: z.string().min(1).max(100) }).strict())
	.handler(async ({ data }) => {
		const { publicProjectContent } =
			await import('@altstack/api/queries/project-mentions')
		const project = await publicProjectContent(data.slug)
		if (!project?.content) return emptyPublicContent()
		const { prepareContent } = await import('./prepare.server')
		return prepareContent({ slug: data.slug, content: project.content })
	})
