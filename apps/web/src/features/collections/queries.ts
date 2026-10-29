import { orpc } from '#/utils/orpc'
export const collectionQueries = {
	list: (page = 1, limit = 12) =>
		orpc.collection.list.queryOptions({ input: { query: { page, limit } } }),
	bySlug: (slug: string) =>
		orpc.collection.getBySlug.queryOptions({ input: { params: { slug } } }),
}
export const adminCollectionQueries = {
	list: (page = 1) =>
		orpc.admin.collection.list.queryOptions({
			input: { query: { page, limit: 20 } },
		}),
	byId: (id: string) =>
		orpc.admin.collection.getById.queryOptions({ input: { params: { id } } }),
}
