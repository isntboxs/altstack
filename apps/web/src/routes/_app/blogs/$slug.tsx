import { createFileRoute, notFound } from '@tanstack/react-router'

import {
	ProjectPending,
	PublicError,
	PublicNotFound,
} from '#/components/public-page-state'
import { BlogArticle } from '#/features/blogs/components'
import { blogQueries } from '#/features/blogs/queries'
import { publicContentOptions } from '#/features/public-content/queries'
import { publicUrl, seoHead, unavailableHead } from '#/features/seo/meta'
import { resolveFileUrl } from '#/utils/storage'

export const Route = createFileRoute('/_app/blogs/$slug')({
	shouldReload: ({ cause }) => cause !== 'stay',
	loader: async ({ context, params }) => {
		try {
			const post = await context.queryClient.query({
				...blogQueries.bySlug(params.slug),
				retry: false,
			})
			const prepared = await context.queryClient.query(
				publicContentOptions(post.slug, post.content, 'blog')
			)
			return { post, prepared }
		} catch (error) {
			if (
				typeof error === 'object' &&
				error !== null &&
				'code' in error &&
				(error.code === 'NOT_FOUND' || error.code === 'BAD_REQUEST')
			) {
				throw notFound()
			}
			throw error
		}
	},
	head: ({ loaderData }) =>
		loaderData
			? seoHead({
					title: `${loaderData.post.title} | AltStack`,
					description: loaderData.post.description,
					path: `/blogs/${loaderData.post.slug}`,
					image: resolveFileUrl(loaderData.post.coverUrl),
					imageAlt: loaderData.post.title,
					entities: [
						{
							'@type': 'BlogPosting',
							headline: loaderData.post.title,
							description: loaderData.post.description,
							image: resolveFileUrl(loaderData.post.coverUrl),
							url: publicUrl(`/blogs/${loaderData.post.slug}`),
							datePublished: loaderData.post.publishedAt.toISOString(),
							dateModified: loaderData.post.updatedAt.toISOString(),
							author: { '@type': 'Person', name: loaderData.post.authorName },
							publisher: { '@id': publicUrl('/#organization') },
						},
					],
				})
			: unavailableHead(),
	notFoundComponent: () => <PublicNotFound title="Blog post not found" />,
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: ProjectPending,
	errorComponent: () => <PublicError title="Unable to load blog post" />,
	component: Page,
})

function Page() {
	const { post, prepared } = Route.useLoaderData()
	return <BlogArticle key={post.id} post={post} prepared={prepared} />
}
