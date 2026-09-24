import { useSuspenseQuery } from '@tanstack/react-query'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

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

import { adminProjectQueries } from '#/features/admin-projects/queries'

type CategoryItem =
	ORPCRouterOutputs['admin']['project']['listCategories']['categories'][number]

const MAX_CATEGORIES = 3

interface CategoryComboboxProps {
	id: string
	value: Array<string>
	onValueChange: (value: Array<string>) => void
}

export const CategoryCombobox = ({
	id,
	value,
	onValueChange,
}: CategoryComboboxProps) => {
	const anchor = useComboboxAnchor()

	const { data } = useSuspenseQuery(adminProjectQueries.listCategories())

	const nameBySlug = new Map<string, string>(
		data.categories.map((category: CategoryItem) => [
			category.slug,
			category.name,
		])
	)
	const items = data.categories.map((category: CategoryItem) => category.slug)

	return (
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
					(nameBySlug.get(slug) ?? '').toLowerCase().includes(q)
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
							<ComboboxChipsInput id={id} />
						</>
					)}
				</ComboboxValue>
			</ComboboxChips>

			<ComboboxContent anchor={anchor}>
				<ComboboxEmpty>No items found.</ComboboxEmpty>
				<ComboboxList>
					{(slug: string) => (
						<ComboboxItem key={slug} value={slug}>
							{nameBySlug.get(slug) ?? slug}
						</ComboboxItem>
					)}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	)
}
