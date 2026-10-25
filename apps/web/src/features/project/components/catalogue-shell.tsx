import { getRouteApi, Outlet, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'

import { FilterSection } from '#/components/filter-section'
import { HeroSection } from '#/components/hero-section'
import { CategoryControlsSkeleton } from '#/components/public-skeletons'
import {
	CategoryBreadcrumb,
	CategoryLinks,
} from '#/features/category/components/public-category'
import { LicenseProjectControls } from '#/features/license/components/public-license'
import { HomeFilterSection } from '#/features/project/components/home-filters'
import {
	TagDirectoryControls,
	TagProjectControls,
} from '#/features/tag/components/public-tag'

const categoryRoute = getRouteApi('/_app/categories/$')

/**
 * Selects catalogue controls for home, category, and tag routes outside the leaf
 * pending boundary, so new results preserve the search input and keyboard focus.
 */
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
	if (routeId === '/_app/licenses/$slug') {
		return (
			<>
				<LicenseProjectControls />
				<Outlet />
			</>
		)
	}
	if (routeId === '/_app/tags/') {
		return (
			<>
				<TagDirectoryControls />
				<Outlet />
			</>
		)
	}
	if (routeId === '/_app/tags/$slug') {
		return (
			<>
				<TagProjectControls />
				<Outlet />
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
	const routeData = useRouterState({
		select: (state) =>
			state.matches.find((match) => match.routeId === '/_app/categories/$')
				?.loaderData,
	})
	// Keep committed category identity while the next result page loads. Reading
	// route data avoids an observer cancelling the loader when Suspense unmounts.
	const [data, setData] = useState(routeData)
	if (routeData && routeData !== data) setData(routeData)

	const { q, sort, page } = categoryRoute.useSearch()
	const navigate = categoryRoute.useNavigate()
	if (!data || data.category.path !== _splat) {
		return <CategoryControlsSkeleton />
	}
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
				defaultSort="most-stars"
				defaultSortLabel="Order by"
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
