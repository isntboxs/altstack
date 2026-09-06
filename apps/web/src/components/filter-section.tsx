import {
	IconFilter2Down,
	IconFilter2Up,
	IconSearch,
	IconX,
} from '@tabler/icons-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate, useRouter } from '@tanstack/react-router'
import { cn } from 'cn'
import { Suspense, useEffect, useState } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import type { SearchSortType } from '@altstack/shared/schemas/project'

import { Button } from '@altstack/ui/components/button'
import { ButtonGroup } from '@altstack/ui/components/button-group'
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@altstack/ui/components/collapsible'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@altstack/ui/components/input-group'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from '@altstack/ui/components/select'

import { projectQueries } from '#/features/project/queries'

const routeApi = getRouteApi('/_app/')

const selectSortItems: Array<{ label: string; value: SearchSortType }> = [
	{ label: 'Latest', value: 'newest' },
	{ label: 'Oldest', value: 'oldest' },
	{ label: 'Name', value: 'name' },
	{ label: 'Most Stars', value: 'most-stars' },
	{ label: 'Most Forks', value: 'most-forks' },
]

function toSelectCategoryItem(
	categories: ORPCRouterOutputs['project']['listCategories']['categories']
): Array<{ label: string; value: string }> {
	return categories.map((category) => {
		return {
			label: category.name,
			value: category.slug,
		}
	})
}

const CardCategoryFilter = () => {
	const { data } = useSuspenseQuery(projectQueries.listCategories())
	const { category } = routeApi.useSearch()
	const navigate = useNavigate()

	const handleCategoryChange = (value: string | null) => {
		if (value == null) return
		void navigate({
			to: '.',
			search: (prev) => {
				return {
					...prev,
					category: value,
					page: undefined,
				}
			},
			replace: true,
			viewTransition: true,
		})
	}

	const items = [...toSelectCategoryItem(data.categories)]

	return (
		<Select
			items={items}
			value={category ?? null}
			onValueChange={handleCategoryChange}
		>
			<SelectTrigger className="w-full">
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

const SelectSortBar = () => {
	const { sort } = routeApi.useSearch()
	const navigate = useNavigate()

	const handleSortChange = (value: SearchSortType | null) => {
		if (value == null) return
		void navigate({
			to: '.',
			search: (prev) => {
				return {
					...prev,
					sort: value === 'newest' ? undefined : value,
					page: undefined,
				}
			},
			replace: true,
			viewTransition: true,
		})
	}

	return (
		<Select
			items={selectSortItems}
			value={sort ?? 'newest'}
			onValueChange={handleSortChange}
		>
			<SelectTrigger className="w-full md:max-w-48">
				<SelectValue placeholder="Order By" />
			</SelectTrigger>

			<SelectContent>
				<SelectGroup>
					<SelectLabel>Order By</SelectLabel>
					{selectSortItems.map((item) => (
						<SelectItem key={item.value} value={item.value}>
							{item.label}
						</SelectItem>
					))}
				</SelectGroup>
			</SelectContent>
		</Select>
	)
}

export const FilterSection = () => {
	const [isOpen, setIsOpen] = useState<boolean>(false)
	const { category, q, sort } = routeApi.useSearch()
	const navigate = useNavigate()
	const router = useRouter()

	const [inputValue, setInputValue] = useState(q ?? '')
	const [prevQ, setPrevQ] = useState(q)
	if (q !== prevQ) {
		setPrevQ(q)
		setInputValue(q ?? '')
	}

	useEffect(() => {
		const handler = window.setTimeout(() => {
			const trimmed = inputValue.trim()
			const nextQ = trimmed === '' ? undefined : trimmed
			if (nextQ !== (q ?? undefined)) {
				void navigate({
					to: '.',
					search: (prev) => {
						return { ...prev, q: nextQ, page: undefined }
					},
					replace: true,
					viewTransition: true,
				})
			}
		}, 500)
		return () => window.clearTimeout(handler)
	}, [inputValue, navigate, q])

	const hasActiveFilters =
		Boolean(q) || Boolean(category) || (sort !== undefined && sort !== 'newest')

	const handleReset = () => {
		setInputValue('')
		void navigate({
			to: '.',
			search: (prev) => {
				return {
					...prev,
					category: undefined,
					page: undefined,
					q: undefined,
					sort: undefined,
				}
			},
			replace: true,
			viewTransition: true,
		})

		void router.invalidate()
	}

	return (
		<Collapsible
			open={isOpen}
			onOpenChange={setIsOpen}
			className="container mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 lg:px-16"
		>
			<div className="flex w-full flex-col items-center justify-between gap-2 md:flex-row">
				<ButtonGroup className="w-full">
					<InputGroup>
						<InputGroupAddon>
							<IconSearch />
						</InputGroupAddon>

						<InputGroupInput
							placeholder="Search..."
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
						/>
					</InputGroup>

					{hasActiveFilters && (
						<Button variant="outline" onClick={handleReset}>
							<IconX />
							<span>Reset</span>
						</Button>
					)}

					<CollapsibleTrigger
						render={
							<Button
								variant="outline"
								className={cn(isOpen && 'bg-secondary!')}
							>
								{isOpen ? <IconFilter2Up /> : <IconFilter2Down />}
								<span>Filter</span>
							</Button>
						}
					/>
				</ButtonGroup>

				<SelectSortBar />
			</div>

			<CollapsibleContent className="h-(--collapsible-panel-height) w-full overflow-hidden transition-[height] duration-200 ease-in-out data-ending-style:h-0 data-starting-style:h-0">
				<Suspense fallback={<div>Loading...</div>}>
					<CardCategoryFilter />
				</Suspense>
			</CollapsibleContent>
		</Collapsible>
	)
}
