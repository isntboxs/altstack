import {
	IconFilter2Down,
	IconFilter2Up,
	IconSearch,
	IconX,
} from '@tabler/icons-react'
import { cn } from 'cn'
import { useEffect, useState } from 'react'
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

const selectSortItems: Array<{ label: string; value: SearchSortType }> = [
	{ label: 'Latest', value: 'newest' },
	{ label: 'Oldest', value: 'oldest' },
	{ label: 'Name', value: 'name' },
	{ label: 'Most Stars', value: 'most-stars' },
	{ label: 'Most Forks', value: 'most-forks' },
]

const SelectSortBar = ({
	sort,
	onSortChange,
}: {
	sort?: SearchSortType
	onSortChange: (sort: SearchSortType | undefined) => void
}) => {
	const handleSortChange = (value: SearchSortType | null) => {
		if (value !== null) onSortChange(value === 'newest' ? undefined : value)
	}

	return (
		<Select
			items={selectSortItems}
			value={sort ?? 'newest'}
			onValueChange={handleSortChange}
		>
			<SelectTrigger aria-label="Order by" className="w-full md:max-w-48">
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

export const FilterSection = ({
	q,
	sort,
	page,
	category,
	categorySelector,
	placeholder = 'Search...',
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
	onQueryChange: (q: string | undefined) => void
	onSortChange: (sort: SearchSortType | undefined) => void
	onReset: () => void
}) => {
	const [isOpen, setIsOpen] = useState(false)
	const [inputValue, setInputValue] = useState(q ?? '')

	// URL changes from reset/back/forward must replace a pending local draft.
	useEffect(() => {
		// oxlint-disable-next-line react-hooks-js/set-state-in-effect -- Synchronize an external URL value with the editable, debounced draft.
		setInputValue(q ?? '')
	}, [q])

	useEffect(() => {
		const timer = window.setTimeout(() => {
			const nextQ = inputValue.trim() || undefined
			if (nextQ !== q) onQueryChange(nextQ)
		}, 500)
		return () => window.clearTimeout(timer)
	}, [inputValue, onQueryChange, q])

	const hasActiveFilters =
		Boolean(inputValue) ||
		Boolean(category) ||
		(sort !== undefined && sort !== 'newest') ||
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
				<ButtonGroup className="w-full">
					<InputGroup>
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

				<SelectSortBar sort={sort} onSortChange={onSortChange} />
			</div>

			{categorySelector && (
				<CollapsibleContent className="h-(--collapsible-panel-height) w-full overflow-hidden transition-[height] duration-200 ease-in-out data-ending-style:h-0 data-starting-style:h-0">
					{categorySelector}
				</CollapsibleContent>
			)}
		</Collapsible>
	)
}
