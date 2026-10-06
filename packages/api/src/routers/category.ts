import { publicProcedure } from '@altstack/api/procedures'
import {
	getCategoryByPath,
	listPublicCategories,
} from '@altstack/api/queries/category'

export const categoryRouter = {
	list: publicProcedure.category.list.handler(async ({ context }) => {
		return { categories: await listPublicCategories(context.db) }
	}),
	getByPath: publicProcedure.category.getByPath.handler(
		async ({ context, input, errors }) => {
			const detail = await getCategoryByPath(context.db, input.path)
			if (!detail) throw errors.NOT_FOUND()
			return detail
		}
	),
}
