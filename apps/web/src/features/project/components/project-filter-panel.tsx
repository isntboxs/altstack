import { useId, useState } from 'react'

import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import { Checkbox } from '@altstack/ui/components/checkbox'
import {
	FieldLabel,
	FieldLegend,
	FieldSet,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import { Skeleton } from '@altstack/ui/components/skeleton'

interface FilterOption {
	slug: string
	name: string
	projectCount: number
}

export function ProjectFilterPanel({
	label,
	options,
	selected,
	onToggle,
	isPending,
	isError,
	onRetry,
}: {
	label: string
	options: ReadonlyArray<FilterOption>
	selected: ReadonlyArray<string>
	onToggle: (slug: string) => void
	isPending: boolean
	isError: boolean
	onRetry: () => void
}) {
	const id = useId()
	const [query, setQuery] = useState('')
	const selectedSlugs = new Set(selected)
	const term = query.trim().toLowerCase()
	const filtered = options.filter((option) =>
		`${option.name} ${option.slug}`.toLowerCase().includes(term)
	)

	return (
		<FieldSet className="min-w-0 gap-0 rounded-lg border pb-1">
			<FieldLegend className="sr-only">{label}</FieldLegend>
			<label htmlFor={id} className="sr-only">
				Search {label.toLowerCase()}
			</label>
			<Input
				id={id}
				placeholder={`Search ${label.toLowerCase()}`}
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				className="w-full shrink-0 rounded-sm rounded-b-none border-0 border-b border-border"
			/>
			<div className="h-48 overflow-y-auto overscroll-contain p-1">
				{isPending ? (
					<div aria-busy="true" className="flex flex-col gap-2 p-2">
						<output className="sr-only">
							Loading {label.toLowerCase()} filters…
						</output>
						{Array.from({ length: 6 }, (_, index) => (
							<Skeleton key={index} className="h-6 w-full" />
						))}
					</div>
				) : isError ? (
					<div role="alert" className="flex flex-col items-start gap-2 p-2">
						<p className="text-sm text-muted-foreground">
							Unable to load {label.toLowerCase()} filters.
						</p>
						<Button variant="outline" size="sm" onClick={onRetry}>
							Try again
						</Button>
					</div>
				) : filtered.length === 0 ? (
					<output className="block p-2 text-sm text-muted-foreground">
						{term ? 'No matching options.' : 'No options available yet.'}
					</output>
				) : (
					filtered.map((option) => (
						<FieldLabel
							key={option.slug}
							htmlFor={`${id}-${option.slug}`}
							className="min-h-7 w-full min-w-0 cursor-pointer gap-2 rounded-sm px-2 py-1 hover:bg-muted active:bg-muted has-focus-visible:ring-2 has-focus-visible:ring-ring has-data-checked:bg-muted pointer-coarse:min-h-11"
						>
							<Checkbox
								className="rounded-sm"
								id={`${id}-${option.slug}`}
								aria-description={`${option.projectCount} projects`}
								checked={selectedSlugs.has(option.slug)}
								onCheckedChange={() => onToggle(option.slug)}
							/>
							<span className="min-w-0 flex-1 truncate" title={option.name}>
								{option.name}
							</span>
							<Badge
								variant="secondary"
								aria-hidden="true"
								className="shrink-0 rounded-sm tabular-nums"
							>
								{option.projectCount}
							</Badge>
						</FieldLabel>
					))
				)}
			</div>
		</FieldSet>
	)
}
