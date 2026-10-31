import { createFileRoute } from '@tanstack/react-router'

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@altstack/ui/components/empty'

import { PublicPending, PublicError } from '#/components/public-page-state'
import {
	BlogBreadcrumb,
	BlogCards,
	blogDescription,
} from '#/features/blogs/components'
import { BlogPagination } from '#/features/blogs/pagination'
import { blogQueries } from '#/features/blogs/queries'
import {
	blogSearchMiddlewares,
	blogSearchSchema,
} from '#/features/blogs/search'
import { seoHead } from '#/features/seo/meta'

const pageSize = 12

export const Route = createFileRoute('/_app/blogs/')({
	validateSearch: blogSearchSchema,
	search: { middlewares: blogSearchMiddlewares },
	loaderDeps: ({ search }) => {
		return { page: search.page }
	},
	loader: ({ context, deps }) =>
		context.queryClient.query(blogQueries.list(deps.page, pageSize)),
	head: ({ loaderData, match }) =>
		seoHead({
			title: 'Blogs | AltStack',
			description: blogDescription,
			path:
				match.search.page > 1 ? `/blogs?page=${match.search.page}` : '/blogs',
			noindex:
				!loaderData || (match.search.page > 1 && loaderData.posts.length === 0),
		}),
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: PublicPending,
	errorComponent: () => <PublicError title="Unable to load blogs" />,
	component: Page,
})
function Page() {
	const data = Route.useLoaderData(),
		{ page } = Route.useSearch()
	return (
		<div className="container mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-28 pb-10 lg:px-16">
			<header className="flex flex-col gap-4">
				<BlogBreadcrumb />
				<h1 className="text-3xl font-medium tracking-tight wrap-anywhere sm:text-4xl">
					Blogs
				</h1>
				<p className="max-w-3xl text-lg leading-7 text-muted-foreground">
					{blogDescription}
				</p>
			</header>
			<div id="blog-results" className="scroll-mt-24">
				{data.posts.length > 0 ? (
					<BlogCards posts={data.posts} />
				) : (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>No blogs yet</EmptyTitle>
							<EmptyDescription>
								Published blogs will appear here.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)}
			</div>
			<BlogPagination
				page={page}
				totalPages={Math.ceil(data.total / pageSize)}
			/>
		</div>
	)
}
