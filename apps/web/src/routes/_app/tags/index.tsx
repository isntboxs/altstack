import { createFileRoute } from '@tanstack/react-router'

import { seoHead, unavailableHead } from '#/features/seo/meta'
import {
	TagDirectoryResults,
	TagResultsPending,
	TagsError,
} from '#/features/tag/components/public-tag'
import { tagQueries } from '#/features/tag/queries'
import { tagSearchSchema } from '#/features/tag/search'

export const Route = createFileRoute('/_app/tags/')({
	validateSearch: tagSearchSchema,
	loaderDeps: ({ search: { q, letter, sort, page } }) => {
		return {
			q,
			letter,
			sort,
			page,
		}
	},
	loader: ({ context, deps }) =>
		context.queryClient.query(tagQueries.list(deps)),
	head: ({ loaderData, match }) =>
		loaderData
			? seoHead({
					title: 'Browse Open Source Tags | AltStack',
					description:
						'Discover topics to find your best open source software options.',
					path: '/tags',
					noindex: Boolean(
						Boolean(match.search.q) ||
						Boolean(match.search.letter) ||
						Boolean(match.search.sort) ||
						Boolean(match.search.page)
					),
				})
			: unavailableHead(),
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: TagResultsPending,
	errorComponent: TagsError,
	component: TagsDirectory,
})

/** Passes the route's validated, loaded directory page to the shared tag results UI. */
function TagsDirectory() {
	return <TagDirectoryResults data={Route.useLoaderData()} />
}
