import { useSuspenseQuery } from '@tanstack/react-query'

import { CategoryComboboxView } from '#/components/category-combobox-view'
import type { CategoryComboboxProps } from '#/components/category-combobox-view'
import { adminCategoryQueries } from '#/features/admin-categories/queries'

export function CategoryCombobox(props: CategoryComboboxProps) {
	const { data } = useSuspenseQuery(adminCategoryQueries.list())
	return <CategoryComboboxView {...props} categories={data.categories} />
}
