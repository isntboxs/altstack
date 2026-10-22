import { adminORPC } from '#/utils/orpc'

export const adminFeaturedQueries = {
	list: () => adminORPC.featured.list.queryOptions({ input: {}, staleTime: 0 }),
}
