import {
	IconFilter2Down,
	IconFilter2Up,
	IconSearch,
	IconX,
} from '@tabler/icons-react'
import { cn } from 'cn'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

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

export const selectSortItems: Array<{ label: string; value: SearchSortType }> =
	[
		{ label: 'Verified first', value: 'recommended' },
		{ label: 'Oldest', value: 'oldest' },
		{ label: 'Latest', value: 'newest' },
		{ label: 'Most popular', value: 'most-popular' },
		{ label: 'Name (A to Z)', value: 'name' },
		{ label: 'Name (Z to A)', value: 'name-desc' },
		{ label: 'Most stars', value: 'most-stars' },
		{ label: 'Trending', value: 'trending' },
		{ label: 'Most forks', value: 'most-forks' },
		{ label: 'Last commit', value: 'last-commit' },
		{ label: 'Repository age', value: 'repository-age' },
	]

const SelectSortBar = ({
	sort,
	defaultSort,
	defaultSortLabel,
	onSortChange,
}: {
	sort?: SearchSortType
	defaultSort: SearchSortType
	defaultSortLabel?: string
	onSortChange: (sort: SearchSortType | undefined) => void
}) => {
	const items = selectSortItems.map((item) =>
		item.value === defaultSort && defaultSortLabel
			? { ...item, label: defaultSortLabel }
			: item
	)
	const handleSortChange = (value: SearchSortType | null) => {
		if (value !== null) onSortChange(value)
	}

	return (
		<Select
			items={items}
			value={sort ?? defaultSort}
			onValueChange={handleSortChange}
		>
			<SelectTrigger aria-label="Order by" className="w-full md:max-w-48">
				<SelectValue placeholder="Order by" />
			</SelectTrigger>

			<SelectContent>
				<SelectGroup>
					{!defaultSortLabel && <SelectLabel>Order By</SelectLabel>}
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

export const FilterSection = ({
	q,
	sort,
	page,
	category,
	categorySelector,
	placeholder = 'Search...',
	defaultSort = 'newest',
	defaultSortLabel,
	onQueryChange,
	onSortChange,
	onReset,
}: {
	q?: string
	sort?: SearchSortType
	page?: number
	category?: string
	categorySelector?: ReactNode
	placeholder?: string
	defaultSort?: SearchSortType
	defaultSortLabel?: string
	onQueryChange: (q: string | undefined) => void
	onSortChange: (sort: SearchSortType | undefined) => void
	onReset: () => void
}) => {
	const [isOpen, setIsOpen] = useState(false)
	const [inputValue, setInputValue] = useState(q ?? '')
	const submittedQuery = useRef<{ value: string | undefined } | null>(null)

	// URL changes from reset/back/forward must replace a pending local draft.
	useEffect(() => {
		if (
			submittedQuery.current?.value === q &&
			submittedQuery.current !== null
		) {
			submittedQuery.current = null
			return
		}
		submittedQuery.current = null
		// oxlint-disable-next-line react-hooks-js/set-state-in-effect -- Synchronize an external URL value with the editable, debounced draft.
		setInputValue(q ?? '')
	}, [q])

	useEffect(() => {
		const timer = window.setTimeout(() => {
			const nextQ = inputValue.trim() || undefined
			if (nextQ !== q) {
				submittedQuery.current = { value: nextQ }
				onQueryChange(nextQ)
			}
		}, 500)
		return () => window.clearTimeout(timer)
	}, [inputValue, onQueryChange, q])

	const hasActiveFilters =
		Boolean(inputValue) ||
		Boolean(category) ||
		(sort !== undefined && sort !== defaultSort) ||
		(page ?? 1) > 1
	const handleReset = () => {
		setInputValue('')
		onReset()
	}

	return (
		<Collapsible
			open={isOpen}
			onOpenChange={setIsOpen}
			className="container mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 lg:px-16"
		>
			<div className="flex w-full flex-col items-center justify-between gap-2 md:flex-row">
				<ButtonGroup className="w-full min-w-0">
					<InputGroup className="min-w-0">
						<InputGroupAddon>
							<IconSearch />
						</InputGroupAddon>

						<InputGroupInput
							aria-label={placeholder}
							placeholder={placeholder}
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

					{categorySelector && (
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
					)}
				</ButtonGroup>

				<SelectSortBar
					sort={sort}
					defaultSort={defaultSort}
					defaultSortLabel={defaultSortLabel}
					onSortChange={onSortChange}
				/>
			</div>

			{inputValue.trim() !== (q ?? '') && (
				<output className="w-full text-sm text-muted-foreground">
					Search update pending…
				</output>
			)}
			{categorySelector && (
				<CollapsibleContent className="h-(--collapsible-panel-height) w-full overflow-hidden transition-[height] duration-200 ease-in-out data-ending-style:h-0 data-starting-style:h-0">
					{categorySelector}
				</CollapsibleContent>
			)}
		</Collapsible>
	)
}
