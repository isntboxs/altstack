import {
	createFileRoute,
	Link,
	notFound,
	redirect,
} from '@tanstack/react-router'

import { ProjectListSection } from '#/components/project-list-section'
import { PublicPending } from '#/components/public-page-state'
import {
	CategoriesError,
	CategoryNotFound,
} from '#/features/category/components/public-category'
import { categoryHead } from '#/features/category/meta'
import { isCategoryPath } from '#/features/category/path'
import { categoryQueries } from '#/features/category/queries'
import { categoryRedirectSearch } from '#/features/category/redirect-search'
import { categoryRequestMiddleware } from '#/features/category/request'
import { categoryProjectPageLink } from '#/features/project/page-links'
import { projectQueries } from '#/features/project/queries'
import { projectFilterSearchSchema } from '#/features/project/search'
import { unavailableHead } from '#/features/seo/meta'

export const Route = createFileRoute('/_app/categories/$')({
	server: { middleware: [categoryRequestMiddleware] },
	validateSearch: projectFilterSearchSchema,
	loaderDeps: ({ search: { q, sort, page } }) => {
		return { q, sort, page }
	},
	loader: async ({ context, params, deps, location }) => {
		const path = params._splat ?? ''
		if (!isCategoryPath(path)) {
			throw notFound()
		}
		const detail = await context.queryClient
			.query({
				...categoryQueries.getByPath({ path }),
				retry: false,
			})
			.catch((error: unknown) => {
				if (
					typeof error === 'object' &&
					error !== null &&
					'code' in error &&
					error.code === 'NOT_FOUND'
				) {
					throw notFound()
				}
				throw error
			})
		if (detail.category.path !== path) {
			// Only the API's canonical category path determines the destination.
			// href retains the raw query, unlike a parsed search object.
			throw redirect({
				href: `/categories/${detail.category.path}${categoryRedirectSearch(location)}`,
				statusCode: 308,
				replace: true,
				// SPA navigation re-serializes href search (including duplicate
				// keys). A document navigation preserves the original query.
				reloadDocument: true,
			})
		}
		const projects = await context.queryClient.query(
			projectQueries.search({
				...deps,
				category: detail.category.slug,
			})
		)
		return { ...detail, projects }
	},
	head: ({ loaderData, match }) =>
		loaderData
			? categoryHead(
					loaderData.category,
					match.search,
					loaderData.projects.pagination.totalPages
				)
			: unavailableHead(),
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: PublicPending,
	notFoundComponent: CategoryNotFound,
	errorComponent: CategoriesError,
	component: CategoryDetail,
})

function CategoryDetail() {
	const { category, projects } = Route.useLoaderData()
	const { q, sort } = Route.useSearch()
	const filtersActive = Boolean(q) || (sort !== undefined && sort !== 'newest')
	return (
		<ProjectListSection
			data={projects}
			emptyMessage={
				category.projectCount === 0
					? 'There are no published projects in this category yet.'
					: filtersActive
						? 'No projects match your current filters. Try a different search term or clear filters above.'
						: 'There are no projects on this page. Try an earlier page.'
			}
			emptyAction={
				filtersActive ? (
					<Link
						to="/categories/$"
						params={{ _splat: category.path }}
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
			pageLinkOptions={(nextPage) =>
				categoryProjectPageLink(category.path, nextPage)
			}
		/>
	)
}
