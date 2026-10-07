import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Suspense } from 'react'

import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from '@altstack/ui/components/select'

import { FilterSection } from '#/components/filter-section'
import { projectQueries } from '#/features/project/queries'

const routeApi = getRouteApi('/_app/')

function HomeCategorySelector() {
	const { data } = useSuspenseQuery(projectQueries.listCategories())
	const { category } = routeApi.useSearch()
	const navigate = routeApi.useNavigate()
	const items = data.categories.map(({ name, slug }) => {
		return {
			label: name,
			value: slug,
		}
	})
	return (
		<Select
			items={items}
			value={category ?? null}
			onValueChange={(value) => {
				if (value === null) return
				void navigate({
					search: (prev) => {
						return { ...prev, category: value, page: undefined }
					},
					replace: true,
					viewTransition: true,
				})
			}}
		>
			<SelectTrigger aria-label="Category" className="w-full">
				<SelectValue placeholder="Select Category" />
			</SelectTrigger>
			<SelectContent>
				<SelectGroup>
					<SelectLabel>Category</SelectLabel>
					{items.map((item) => (
						<SelectItem key={item.value} value={item.value}>
							{item.label}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	)
}

export function HomeFilterSection() {
	const { q, sort, page, category } = routeApi.useSearch()
	const navigate = routeApi.useNavigate()
	return (
		<FilterSection
			q={q}
			sort={sort}
			page={page}
			category={category}
			categorySelector={
				<Suspense fallback={<output>Loading categories…</output>}>
					<HomeCategorySelector />
				</Suspense>
			}
			onQueryChange={(nextQ) =>
				void navigate({
					search: (prev) => {
						return { ...prev, q: nextQ, page: undefined }
					},
					replace: true,
					viewTransition: true,
				})
			}
			onSortChange={(nextSort) =>
				void navigate({
					search: (prev) => {
						return { ...prev, sort: nextSort, page: undefined }
					},
					replace: true,
					viewTransition: true,
				})
			}
			onReset={() =>
				void navigate({
					search: (prev) => {
						return {
							...prev,
							category: undefined,
							q: undefined,
							sort: undefined,
							page: undefined,
						}
					},
					replace: true,
					viewTransition: true,
				})
			}
		/>
	)
}
