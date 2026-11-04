import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { blogSlugSchema, collectionSlugSchema } from '@altstack/shared/schemas'

import { emptyPublicContent } from '#/features/public-content/model'

export const preparePublicContent = createServerFn({ method: 'POST' })
	.validator(z.strictObject({ slug: z.string().min(1).max(100) }))
	.handler(async ({ data }) => {
		const { publicProjectContent } =
			await import('@altstack/api/queries/project-mentions')
		const project = await publicProjectContent(data.slug)
		if (!project?.content) return emptyPublicContent()
		const { prepareContent } = await import('./prepare.server')
		return prepareContent({ slug: data.slug, content: project.content })
	})

export const preparePublicBlogContent = createServerFn({ method: 'POST' })
	.validator(z.strictObject({ slug: blogSlugSchema }))
	.handler(async ({ data }) => {
		const { publicBlogContent } = await import('@altstack/api/queries/blog')
		const post = await publicBlogContent(data.slug)
		if (!post) return emptyPublicContent()
		const { prepareContent } = await import('./prepare.server')
		return prepareContent({ slug: `blogs/${data.slug}`, content: post.content })
	})

export const preparePublicPageContent = createServerFn({ method: 'POST' })
	.validator(
		z.discriminatedUnion('kind', [
			z.strictObject({
				kind: z.literal('collection'),
				slug: collectionSlugSchema,
			}),
			z.strictObject({ kind: z.literal('about'), slug: z.literal('about') }),
		])
	)
	.handler(async ({ data }) => {
		const { client } = await import('#/utils/orpc')
		const page =
			data.kind === 'collection'
				? await client.collection.getBySlug({ params: { slug: data.slug } })
				: await client.about.get({})
		if (!page.content) return emptyPublicContent()
		const { prepareContent } = await import('./prepare.server')
		return prepareContent({
			slug: data.kind === 'collection' ? `collections/${data.slug}` : 'about',
			content: page.content,
		})
	})
