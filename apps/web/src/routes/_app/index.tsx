import { createFileRoute, Link } from '@tanstack/react-router'

import { ProjectListSection } from '#/components/project-list-section'
import { PublicPending, PublicError } from '#/components/public-page-state'
import { homeProjectPageLink } from '#/features/project/page-links'
import { projectQueries } from '#/features/project/queries'
import { homeProjectSearchSchema } from '#/features/project/search'
import {
	cataloguePolicy,
	publicUrl,
	seoHead,
	siteDescription,
	unavailableHead,
} from '#/features/seo/meta'

export const Route = createFileRoute('/_app/')({
	validateSearch: homeProjectSearchSchema,
	loaderDeps: ({ search: { category, page, q, sort } }) => {
		return {
			category,
			page,
			q,
			sort,
		}
	},
	loader: ({ context, deps }) =>
		context.queryClient.query(projectQueries.search(deps)),
	head: ({ loaderData, match }) => {
		if (!loaderData) return unavailableHead()
		const policy = cataloguePolicy(
			'/',
			match.search,
			loaderData.pagination.totalPages
		)
		return seoHead({
			title: `AltStack — Discover open-source software${policy.pageSuffix}`,
			description: siteDescription,
			...policy,
			entities: [
				{
					'@type': 'CollectionPage',
					name: 'Discover open-source software',
					url: publicUrl(policy.path),
				},
			],
		})
	},
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: PublicPending,
	errorComponent: () => <PublicError title="Unable to load projects" />,
	component: Home,
})

function Home() {
	const { category, page, q, sort } = Route.useSearch()
	const data = Route.useLoaderData()
	const hasFilters =
		Boolean(category) || Boolean(q) || (sort !== undefined && sort !== 'newest')

	return (
		<>
			<ProjectListSection
				data={data}
				pageLinkOptions={homeProjectPageLink}
				emptyAction={
					hasFilters ? (
						<Link
							to="/"
							className="inline-flex items-center underline underline-offset-4"
						>
							Clear filters
						</Link>
					) : (
						<Link
							to="/categories"
							className="inline-flex items-center underline underline-offset-4"
						>
							Browse categories
						</Link>
					)
				}
				emptyMessage={
					hasFilters
						? 'No projects match your current filters. Try a different search term or clear filters above.'
						: (page ?? 1) > 1
							? 'There are no projects on this page. Try an earlier page.'
							: 'There are no published projects available in the catalogue yet.'
				}
			/>
		</>
	)
}
