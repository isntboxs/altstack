import { getRouteApi, Link, useRouterState } from '@tanstack/react-router'
import { useState } from 'react'

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@altstack/ui/components/breadcrumb'

import { FilterSection } from '#/components/filter-section'
import { PublicError, PublicNotFound } from '#/components/public-page-state'
import { CategoryControlsSkeleton } from '#/components/public-skeletons'

const detailRoute = getRouteApi('/_app/licenses/$slug')

export function LicenseBreadcrumb({ name }: { name?: string }) {
	return (
		<Breadcrumb>
			<BreadcrumbList>
				<BreadcrumbItem>
					<BreadcrumbLink render={<Link to="/" />}>Home</BreadcrumbLink>
				</BreadcrumbItem>
				<BreadcrumbSeparator />
				<BreadcrumbItem>
					{name ? (
						<BreadcrumbLink render={<Link to="/licenses" />}>
							Licenses
						</BreadcrumbLink>
					) : (
						<BreadcrumbPage>Licenses</BreadcrumbPage>
					)}
				</BreadcrumbItem>
				{name && (
					<>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>{name}</BreadcrumbPage>
						</BreadcrumbItem>
					</>
				)}
			</BreadcrumbList>
		</Breadcrumb>
	)
}

export function LicensesError() {
	return <PublicError title="Unable to load licenses" />
}
export function LicenseNotFound() {
	return <PublicNotFound title="License not found" />
}

// Controls live outside the results' pending boundary to preserve focus/drafts.
export function LicenseProjectControls() {
	const { slug } = detailRoute.useParams()
	const routeData = useRouterState({
		select: (state) =>
			state.matches.find((match) => match.routeId === '/_app/licenses/$slug')
				?.loaderData,
	})
	const [data, setData] = useState(routeData)
	if (routeData && data !== routeData) setData(routeData)
	const { q, sort, page } = detailRoute.useSearch()
	const navigate = detailRoute.useNavigate()
	if (!data || data.license.slug !== slug) return <CategoryControlsSkeleton />
	const { license } = data
	const unknown = license.slug === 'unknown'
	return (
		<>
			<div className="container mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pt-28 wrap-anywhere lg:px-16">
				<LicenseBreadcrumb name={license.identifier} />
				<h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
					{unknown
						? 'Projects with unknown License'
						: `${license.identifier} Licensed Open Source Software`}
				</h1>
				<p className="max-w-3xl text-lg leading-7 text-muted-foreground">
					{license.projectCount} published{' '}
					{license.projectCount === 1 ? 'project' : 'projects'}{' '}
					{unknown
						? 'with a license that GitHub has not identified. This includes custom licenses and projects awaiting refresh.'
						: `licensed under ${license.identifier}.`}
				</p>
			</div>
			<FilterSection
				key={slug}
				q={q}
				sort={sort}
				defaultSort="most-stars"
				defaultSortLabel="Order by"
				page={page}
				placeholder={`Search in "${license.identifier}"...`}
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
						resetScroll: false,
					})
				}
				onReset={() => void navigate({ search: {}, resetScroll: false })}
			/>
		</>
	)
}
