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

import { projectQueries } from '#/features/project/queries.ts'

type CategoryItem =
	ORPCRouterOutputs['project']['listCategories']['categories'][number]

const MAX_CATEGORIES = 3

interface CategoryComboboxProps {
	value: Array<string>
	onValueChange: (value: Array<string>) => void
}

export const CategoryCombobox = ({
	value,
	onValueChange,
}: CategoryComboboxProps) => {
	const anchor = useComboboxAnchor()

	const { data } = useSuspenseQuery(projectQueries.listCategories())

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
		>
			<ComboboxChips ref={anchor} className="w-full">
				<ComboboxValue>
					{(values: Array<string>) => (
						<>
							{values.map((slug: string) => (
								<ComboboxChip key={slug}>
									{nameBySlug.get(slug) ?? slug}
								</ComboboxChip>
							))}
							<ComboboxChipsInput />
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
