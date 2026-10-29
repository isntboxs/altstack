import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'

import { buttonVariants } from '@altstack/ui/components/button'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@altstack/ui/components/empty'

import { PublicPending, PublicError } from '#/components/public-page-state'
import { CollectionCards } from '#/features/collections/components'
import { collectionQueries } from '#/features/collections/queries'
import { seoHead } from '#/features/seo/meta'

export const Route = createFileRoute('/_app/collections/')({
	validateSearch: z.object({
		page: z.coerce.number().int().min(1).max(100000).catch(1).default(1),
	}),
	loaderDeps: ({ search }) => {
		return { page: search.page }
	},
	loader: ({ context, deps }) =>
		context.queryClient.query(collectionQueries.list(deps.page)),
	head: ({ loaderData, match }) =>
		seoHead({
			title: 'Collections | AltStack',
			description:
				'Explore public collections of open-source projects curated by AltStack.',
			path:
				match.search.page > 1
					? `/collections?page=${match.search.page}`
					: '/collections',
			noindex:
				!loaderData ||
				(match.search.page > 1 && loaderData.collections.length === 0),
		}),
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: PublicPending,
	errorComponent: () => <PublicError title="Unable to load collections" />,
	component: Page,
})
function Page() {
	const data = Route.useLoaderData(),
		{ page } = Route.useSearch()
	return (
		<div className="container mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-24 pb-12 lg:px-16">
			<header className="flex flex-col gap-3">
				<h1 className="text-4xl font-semibold">Collections</h1>
				<p className="text-muted-foreground">
					Admin-curated collections of listed open-source projects.
				</p>
			</header>
			{data.collections.length > 0 ? (
				<CollectionCards collections={data.collections} />
			) : (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>No collections yet</EmptyTitle>
						<EmptyDescription>
							Published collections will appear here.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
			<nav aria-label="Collection pages" className="flex gap-3">
				{page > 1 && (
					<Link
						to="/collections"
						search={{ page: page - 1 }}
						className={buttonVariants({ variant: 'outline' })}
					>
						Previous
					</Link>
				)}
				{page * 12 < data.total && (
					<Link
						to="/collections"
						search={{ page: page + 1 }}
						className={buttonVariants({ variant: 'outline' })}
					>
						Next
					</Link>
				)}
			</nav>
		</div>
	)
}
