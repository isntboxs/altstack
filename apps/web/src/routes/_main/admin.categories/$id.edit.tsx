import { createFileRoute, notFound } from '@tanstack/react-router'

import { adminCategoryParamsSchema } from '@altstack/shared/schemas/admin-category'

import { CategoryForm } from '#/features/admin-categories/components/category-form'
import { categoryUpdatePayload } from '#/features/admin-categories/model'
import {
	adminCategoryQueries,
	useAdminCategoryGet,
	useAdminCategoryList,
	useAdminCategoryUpdate,
} from '#/features/admin-categories/queries'

export const Route = createFileRoute('/_main/admin/categories/$id/edit')({
	loader: async ({ context, params }) => {
		if (!adminCategoryParamsSchema.safeParse(params).success) {
			throw notFound()
		}
		try {
			await context.queryClient.query({
				...adminCategoryQueries.get({ id: params.id }),
				retry: false,
			})
		} catch (error) {
			if (
				typeof error === 'object' &&
				error !== null &&
				'code' in error &&
				error.code === 'NOT_FOUND'
			) {
				throw notFound()
			}
			throw error
		}
		await context.queryClient.query(adminCategoryQueries.list())
	},
	component: EditCategory,
})

function EditCategory() {
	const { id } = Route.useParams()
	const { data } = useAdminCategoryGet({ id })
	const { data: list } = useAdminCategoryList()
	const mutation = useAdminCategoryUpdate()
	return (
		<CategoryForm
			key={id}
			category={data.category}
			categories={list.categories}
			pending={mutation.isPending}
			onSubmit={async (values, original) => {
				if (!original) return
				await mutation.mutateAsync(categoryUpdatePayload(original, values))
			}}
		/>
	)
}
