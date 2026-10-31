import { createFileRoute, notFound } from '@tanstack/react-router'

import {
	ProjectPending,
	PublicError,
	PublicNotFound,
} from '#/components/public-page-state'
import { BlogArticle } from '#/features/blogs/components'
import { blogQueries } from '#/features/blogs/queries'
import { publicUrl, seoHead, unavailableHead } from '#/features/seo/meta'

export const Route = createFileRoute('/_app/blogs/$slug')({
	shouldReload: ({ cause }) => cause !== 'stay',
	loader: async ({ context, params }) => {
		try {
			return await context.queryClient.query({
				...blogQueries.bySlug(params.slug),
				retry: false,
			})
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
	head: ({ loaderData: post }) =>
		post
			? seoHead({
					title: `${post.title} | AltStack`,
					description: post.description,
					path: `/blogs/${post.slug}`,
					image: post.coverUrl,
					imageAlt: post.title,
					entities: [
						{
							'@type': 'BlogPosting',
							headline: post.title,
							description: post.description,
							image: post.coverUrl,
							url: publicUrl(`/blogs/${post.slug}`),
							datePublished: post.publishedAt.toISOString(),
							dateModified: post.updatedAt.toISOString(),
							author: { '@type': 'Person', name: post.authorName },
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
	const post = Route.useLoaderData()
	return <BlogArticle key={post.id} post={post} />
}
