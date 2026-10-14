import { createFileRoute } from '@tanstack/react-router'

import { HeroSection } from '#/components/hero-section'
import { ProjectListSection } from '#/components/project-list-section'
import { HomeFilterSection } from '#/features/project/components/home-filters'
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
	component: Home,
})

function Home() {
	const { category, page, q, sort } = Route.useSearch()
	const data = Route.useLoaderData()
	const hasFilters =
		Boolean(category) || Boolean(q) || (sort !== undefined && sort !== 'newest')

	return (
		<>
			<HeroSection />
			<HomeFilterSection />
			<ProjectListSection
				data={data}
				pageLinkOptions={homeProjectPageLink}
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
