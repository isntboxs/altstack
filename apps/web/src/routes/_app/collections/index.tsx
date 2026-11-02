import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '@altstack/ui/components/button'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@altstack/ui/components/empty'

import { PublicPending, PublicError } from '#/components/public-page-state'
import { useCatalogueOffset } from '#/features/ads/use-catalogue-offset'
import {
	CollectionBreadcrumb,
	CollectionCards,
} from '#/features/collections/components'
import { CollectionPagination } from '#/features/collections/pagination'
import { collectionQueries } from '#/features/collections/queries'
import {
	collectionSearchMiddlewares,
	collectionSearchSchema,
} from '#/features/collections/search'
import { seoHead } from '#/features/seo/meta'

const pageSize = 45

export const Route = createFileRoute('/_app/collections/')({
	validateSearch: collectionSearchSchema,
	search: { middlewares: collectionSearchMiddlewares },
	loaderDeps: ({ search }) => {
		return { page: search.page }
	},
	loader: ({ context, deps }) =>
		context.queryClient.query(collectionQueries.list(deps.page, pageSize)),
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
/** Displays the loaded directory page with canonical numbered navigation. */
function Page() {
	const loaded = Route.useLoaderData(),
		{ page } = Route.useSearch()
	const expectedOffset = useCatalogueOffset('collections', page)
	const query = useQuery(collectionQueries.list(page, pageSize, expectedOffset))
	const data = query.data ?? loaded
	const [consumed, setConsumed] = useState(45)
	if (!query.data && loaded.offset !== expectedOffset) {
		if (query.isError) {
			return (
				<div role="alert">
					Unable to restore this catalogue page.{' '}
					<Button onClick={() => void query.refetch()}>
						Retry collections
					</Button>
				</div>
			)
		}
		return <output>Loading collections…</output>
	}
	return (
		<div className="container mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-28 pb-10 lg:px-16">
			<header className="flex flex-col gap-4">
				<CollectionBreadcrumb />
				<h1 className="text-3xl font-medium tracking-tight wrap-anywhere sm:text-4xl">
					Collections
				</h1>
				<p className="max-w-3xl text-lg leading-7 text-muted-foreground">
					Explore curated collections of open-source projects.
				</p>
			</header>
			<div id="collection-results" className="scroll-mt-24">
				{data.collections.length > 0 ? (
					<CollectionCards
						collections={data.collections}
						listing={{
							page,
							offset: data.offset ?? (page - 1) * 45,
							onConsumed: setConsumed,
						}}
					/>
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
			</div>
			<CollectionPagination
				page={page}
				totalPages={Math.max(
					page,
					page +
						Math.ceil(
							(data.total -
								(data.offset ?? (page - 1) * 45) -
								Math.min(consumed, data.collections.length)) /
								45
						)
				)}
			/>
		</div>
	)
}
