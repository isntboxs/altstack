import { adminProcedure } from '@altstack/api/procedures'
import {
	getAdminCategoryById,
	listAdminCategories,
} from '@altstack/api/queries/category'
import {
	createAdminCategory,
	removeAdminCategory,
	updateAdminCategory,
} from '@altstack/api/queries/category-integrity'

export const adminCategoryRouter = {
	list: adminProcedure.admin.category.list.handler(async ({ context }) => {
		return { categories: await listAdminCategories(context.db) }
	}),
	getById: adminProcedure.admin.category.getById.handler(
		async ({ context, input, errors }) => {
			const detail = await getAdminCategoryById(context.db, input.params.id)
			if (!detail) {
				throw errors.NOT_FOUND({ message: 'Category does not exist.' })
			}
			return detail
		}
	),
	create: adminProcedure.admin.category.create.handler(({ context, input }) =>
		createAdminCategory(context.db, input.body)
	),
	update: adminProcedure.admin.category.update.handler(({ context, input }) =>
		updateAdminCategory(context.db, { ...input.body, id: input.params.id })
	),
	remove: adminProcedure.admin.category.remove.handler(({ context, input }) =>
		removeAdminCategory(context.db, input.params.id)
	),
}
