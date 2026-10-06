import { createFileRoute } from '@tanstack/react-router'

import { CategoryTable } from '#/features/admin-categories/components/category-table'
import {
	adminCategoryQueries,
	useAdminCategoryList,
} from '#/features/admin-categories/queries'

export const Route = createFileRoute('/_main/admin/categories/')({
	loader: async ({ context }) => {
		await context.queryClient.query(adminCategoryQueries.list())
	},
	component: CategoryDashboard,
})

function CategoryDashboard() {
	const { data } = useAdminCategoryList()
	return (
		<div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
			<div className="space-y-1">
				<h1 className="text-xl font-semibold">Categories</h1>
				<p className="text-sm text-muted-foreground">
					Manage every category, including empty categories, and its place in
					the hierarchy.
				</p>
			</div>
			<CategoryTable categories={data.categories} />
		</div>
	)
}
