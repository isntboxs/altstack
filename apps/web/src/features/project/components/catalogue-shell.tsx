import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Outlet, useRouterState } from '@tanstack/react-router'

import { FilterSection } from '#/components/filter-section'
import { HeroSection } from '#/components/hero-section'
import {
	CategoryBreadcrumb,
	CategoryLinks,
} from '#/features/category/components/public-category'
import { categoryQueries } from '#/features/category/queries'
import { HomeFilterSection } from '#/features/project/components/home-filters'

const categoryRoute = getRouteApi('/_app/categories/$')

// Keep editable controls outside the leaf pending boundary. Results can suspend
// for a new URL without replacing the search input or its keyboard focus.
export function CatalogueShell() {
	const routeId = useRouterState({
		select: (state) =>
			state.matches.at(-1)?.status === 'notFound'
				? undefined
				: state.matches.at(-1)?.routeId,
	})
	if (routeId === '/_app/') {
		return (
			<>
				<HeroSection />
				<section
					id="catalogue"
					tabIndex={-1}
					aria-label="Explore projects"
					className="scroll-mt-16 outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<HomeFilterSection />
					<Outlet />
				</section>
			</>
		)
	}
	if (routeId === '/_app/categories/$') {
		return (
			<>
				<CategoryControls />
				<Outlet />
			</>
		)
	}
	return <Outlet />
}

function CategoryControls() {
	const { _splat } = categoryRoute.useParams()
	// Observe the same loader cache without initiating a second request. Category
	// identity remains available while only the project's search deps change.
	const { data } = useQuery({
		...categoryQueries.getByPath({ path: _splat ?? '' }),
		enabled: false,
	})
	const { q, sort, page } = categoryRoute.useSearch()
	const navigate = categoryRoute.useNavigate()
	if (!data) return null
	const { category, ancestors, children } = data
	return (
		<>
			<div className="container mx-auto w-full max-w-6xl space-y-4 px-4 pt-28 wrap-anywhere lg:px-16">
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
						resetScroll: false,
					})
				}
				onSortChange={(nextSort) =>
					void navigate({
						search: (prev) => {
							return { ...prev, sort: nextSort, page: undefined }
						},
						replace: true,
						resetScroll: false,
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
						resetScroll: false,
					})
				}
			/>
		</>
	)
}
