import { createFileRoute, notFound, redirect } from '@tanstack/react-router'

import { FilterSection } from '#/components/filter-section'
import { ProjectListSection } from '#/components/project-list-section'
import {
	CategoriesError,
	CategoriesPending,
	CategoryBreadcrumb,
	CategoryLinks,
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
	head: ({ loaderData }) =>
		loaderData ? categoryHead(loaderData.category) : {},
	pendingComponent: CategoriesPending,
	notFoundComponent: CategoryNotFound,
	errorComponent: CategoriesError,
	component: CategoryDetail,
})

function CategoryDetail() {
	const { category, ancestors, children, projects } = Route.useLoaderData()
	const { q, sort, page } = Route.useSearch()
	const navigate = Route.useNavigate()
	const filtersActive = Boolean(q) || (sort !== undefined && sort !== 'newest')
	return (
		<>
			<div className="container mx-auto w-full max-w-6xl space-y-4 px-4 pt-28 lg:px-16">
				<CategoryBreadcrumb category={category} ancestors={ancestors} />
				<h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
					Open Source {category.name}
				</h1>
				{category.description && (
					<p className="max-w-3xl text-lg leading-7 text-muted-foreground">
						{category.description}
					</p>
				)}
				{children.length > 0 && (
					<nav
						aria-label="See also"
						className="flex flex-wrap items-center gap-2 pt-2"
					>
						<span className="text-sm text-muted-foreground">See also:</span>
						<CategoryLinks categories={children} />
					</nav>
				)}
			</div>
			<FilterSection
				key={category.id}
				q={q}
				sort={sort}
				page={page}
				placeholder={`Search ${category.name}...`}
				onQueryChange={(nextQ) =>
					void navigate({
						search: (prev) => {
							return { ...prev, q: nextQ, page: undefined }
						},
						replace: true,
					})
				}
				onSortChange={(nextSort) =>
					void navigate({
						search: (prev) => {
							return { ...prev, sort: nextSort, page: undefined }
						},
						replace: true,
					})
				}
				onReset={() =>
					void navigate({
						search: (prev) => {
							return {
								...prev,
								q: undefined,
								sort: undefined,
								page: undefined,
							}
						},
						replace: true,
					})
				}
			/>
			<ProjectListSection
				data={projects}
				emptyMessage={
					category.projectCount === 0
						? 'There are no published projects in this category yet.'
						: filtersActive
							? 'No projects match your current filters. Try a different search term or clear filters above.'
							: 'There are no projects on this page. Try an earlier page.'
				}
				pageLinkOptions={(nextPage) =>
					categoryProjectPageLink(category.path, nextPage)
				}
			/>
		</>
	)
}
