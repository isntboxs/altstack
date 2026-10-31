import { orpc } from '#/utils/orpc'
export const blogQueries = {
	list: (page = 1, limit = 12) =>
		orpc.blog.list.queryOptions({ input: { query: { page, limit } } }),
	bySlug: (slug: string) =>
		orpc.blog.getBySlug.queryOptions({ input: { params: { slug } } }),
}
export const adminBlogQueries = {
	list: (page = 1) =>
		orpc.admin.blog.list.queryOptions({
			input: { query: { page, limit: 20 } },
		}),
	byId: (id: string) =>
		orpc.admin.blog.getById.queryOptions({ input: { params: { id } } }),
}
