import { createFileRoute } from '@tanstack/react-router'

import { adminCreateCategoryInputSchema } from '@altstack/shared/schemas/admin-category'

import { CategoryForm } from '#/features/admin-categories/components/category-form'
import {
	adminCategoryQueries,
	useAdminCategoryCreate,
	useAdminCategoryList,
} from '#/features/admin-categories/queries'

export const Route = createFileRoute('/_main/admin/categories/create')({
	loader: async ({ context }) => {
		await context.queryClient.query(adminCategoryQueries.list())
	},
	component: CreateCategory,
})

function CreateCategory() {
	const { data } = useAdminCategoryList()
	const mutation = useAdminCategoryCreate()
	return (
		<CategoryForm
			categories={data.categories}
			pending={mutation.isPending}
			onSubmit={async (values) => {
				await mutation.mutateAsync(adminCreateCategoryInputSchema.parse(values))
			}}
		/>
	)
}
