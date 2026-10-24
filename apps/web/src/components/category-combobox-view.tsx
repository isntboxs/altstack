import type { CategoryNode } from '@altstack/shared/schemas/category'

import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
	useComboboxAnchor,
} from '@altstack/ui/components/combobox'

import { categoryHelp, categoryLabel } from '#/features/admin-categories/model'

const MAX_CATEGORIES = 3

export interface CategoryComboboxProps {
	id: string
	value: Array<string>
	onValueChange: (value: Array<string>) => void
}

export const CategoryComboboxView = ({
	id,
	value,
	onValueChange,
	categories,
}: CategoryComboboxProps & {
	categories: Array<CategoryNode & { directProjectCount?: number }>
}) => {
	const anchor = useComboboxAnchor()

	const nameBySlug = new Map<string, string>(
		categories.map((category) => [category.slug, category.name])
	)
	const labelBySlug = new Map(
		categories.map((category) => [
			category.slug,
			categoryLabel(category, categories),
		])
	)
	const items = categories
		.filter((category) => category.isLeaf)
		.map((category) => category.slug)
	const stale = value.filter((slug) => !items.includes(slug))

	return (
		<div className="space-y-2">
			<Combobox
				multiple
				autoHighlight
				items={items}
				value={value}
				onValueChange={(next) => {
					if (next.length <= MAX_CATEGORIES) onValueChange(next)
				}}
				filter={(slug, query) => {
					const q = query.trim().toLowerCase()
					if (!q) return true
					return (
						slug.toLowerCase().includes(q) ||
						(labelBySlug.get(slug) ?? '').toLowerCase().includes(q)
					)
				}}
			>
				<ComboboxChips ref={anchor} className="w-full">
					<ComboboxValue>
						{(values: Array<string>) => (
							<>
								{values.map((slug: string) => {
									const label = nameBySlug.get(slug) ?? slug
									return (
										<ComboboxChip key={slug} removeLabel={`Remove ${label}`}>
											{label}
										</ComboboxChip>
									)
								})}
								<ComboboxChipsInput
									id={id}
									aria-describedby={`${id}-category-help`}
								/>
							</>
						)}
					</ComboboxValue>
				</ComboboxChips>

				<ComboboxContent anchor={anchor}>
					<ComboboxEmpty>No items found.</ComboboxEmpty>
					<ComboboxList>
						{(slug: string) => (
							<ComboboxItem
								key={slug}
								value={slug}
								disabled={
									value.length >= MAX_CATEGORIES && !value.includes(slug)
								}
							>
								{labelBySlug.get(slug) ?? slug}
							</ComboboxItem>
						)}
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
			<p id={`${id}-category-help`} className="text-xs text-muted-foreground">
				{categoryHelp}
			</p>
			{stale.length > 0 && (
				<output className="block text-sm text-destructive">
					Some saved categories are unavailable or no longer leaves:{' '}
					{stale.map((slug) => nameBySlug.get(slug) ?? slug).join(', ')}. Their
					assignments are preserved; review them before saving.
				</output>
			)}
		</div>
	)
}
