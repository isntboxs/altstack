import { createFileRoute, notFound } from '@tanstack/react-router'

import {
	ProjectPending,
	PublicError,
	PublicNotFound,
} from '#/components/public-page-state'
import { BlogArticle } from '#/features/blogs/components'
import { blogQueries } from '#/features/blogs/queries'
import { publicContentOptions } from '#/features/public-content/queries'
import { blogHead } from '#/features/seo/blog-meta'
import { unavailableHead } from '#/features/seo/meta'

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
		loaderData ? blogHead(loaderData.post) : unavailableHead(),
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
