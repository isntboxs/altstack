import { IconX } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'

import { Button } from '@altstack/ui/components/button'
import { FieldSet } from '@altstack/ui/components/field'

import { FilterSection } from '#/components/filter-section'
import { categoryQueries } from '#/features/category/queries'
import { licenseQueries } from '#/features/license/queries'
import { ProjectFilterPanel } from '#/features/project/components/project-filter-panel'

const routeApi = getRouteApi('/_app/')

export function HomeFilterSection() {
	const { q, sort, page, category, license } = routeApi.useSearch()
	const navigate = routeApi.useNavigate()
	const categories = useQuery(categoryQueries.list())
	const licenses = useQuery(licenseQueries.list())
	const selectedCategories = category?.split(',') ?? []
	const selectedLicenses = license?.split(',') ?? []
	const hasSelectedFilters =
		selectedCategories.length + selectedLicenses.length > 0
	const groups = [
		{
			key: 'category',
			label: 'Category',
			selected: selectedCategories,
			options: categories.data?.categories ?? [],
			isPending: categories.isPending,
			isError: categories.isError,
			onRetry: () => void categories.refetch(),
		},
		{
			key: 'license',
			label: 'License',
			selected: selectedLicenses,
			options:
				licenses.data?.licenses.map((item) => {
					return {
						...item,
						name: item.identifier,
					}
				}) ?? [],
			isPending: licenses.isPending,
			isError: licenses.isError,
			onRetry: () => void licenses.refetch(),
		},
	] as const
	const toggleFilter = (key: 'category' | 'license', slug: string) => {
		void navigate({
			search: (prev) => {
				const selected = prev[key]?.split(',') ?? []
				const next = selected.includes(slug)
					? selected.filter((value) => value !== slug)
					: [...selected, slug]
				return { ...prev, [key]: next.join(',') || undefined, page: undefined }
			},
			replace: true,
			resetScroll: false,
		})
	}

	return (
		<FilterSection
			q={q}
			sort={sort}
			defaultSort="recommended"
			defaultSortLabel="Order by"
			page={page}
			hasSelectedFilters={hasSelectedFilters}
			filters={
				<div className="flex min-w-0 flex-col gap-2 p-1">
					<div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
						{groups.map(({ key, ...group }) => (
							<ProjectFilterPanel
								key={key}
								{...group}
								onToggle={(slug) => toggleFilter(key, slug)}
							/>
						))}
					</div>
					{hasSelectedFilters && (
						<div
							aria-label="Selected filters"
							className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2"
						>
							{groups
								.filter((group) => group.selected.length > 0)
								.map((group) => (
									<FieldSet
										key={group.key}
										aria-label={`Selected ${group.label.toLowerCase()} filters`}
										className="max-w-full min-w-0 flex-row flex-wrap items-center gap-1"
									>
										<span className="text-xs text-muted-foreground">
											{group.label}:
										</span>
										{group.selected.map((slug) => {
											const name =
												group.options.find((item) => item.slug === slug)
													?.name ?? slug
											return (
												<Button
													key={slug}
													variant="secondary"
													size="xs"
													className="max-w-full rounded-sm"
													aria-label={`Remove ${group.label.toLowerCase()}: ${name}`}
													title={name}
													onClick={() => toggleFilter(group.key, slug)}
												>
													<span className="truncate">{name}</span>
													<IconX data-icon="inline-end" />
												</Button>
											)
										})}
									</FieldSet>
								))}
							<Button
								variant="outline"
								size="xs"
								onClick={() =>
									void navigate({
										search: (prev) => {
											return {
												...prev,
												category: undefined,
												license: undefined,
												page: undefined,
											}
										},
										replace: true,
										resetScroll: false,
									})
								}
							>
								Clear all
							</Button>
						</div>
					)}
				</div>
			}
			onQueryChange={(nextQ) =>
				void navigate({
					search: (prev) => {
						return { ...prev, q: nextQ, page: undefined }
					},
					replace: true,
					resetScroll: false,
					viewTransition: true,
				})
			}
			onSortChange={(nextSort) =>
				void navigate({
					search: (prev) => {
						return { ...prev, sort: nextSort, page: undefined }
					},
					replace: true,
					resetScroll: false,
					viewTransition: true,
				})
			}
			onReset={() =>
				void navigate({
					search: (prev) => {
						return {
							...prev,
							category: undefined,
							license: undefined,
							q: undefined,
							sort: undefined,
							page: undefined,
						}
					},
					replace: true,
					resetScroll: false,
					viewTransition: true,
				})
			}
		/>
	)
}
