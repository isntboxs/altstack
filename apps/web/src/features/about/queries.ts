import { orpc } from '#/utils/orpc'

export const aboutQueries = {
	get: () => orpc.about.get.queryOptions({ input: {} }),
	admin: () => orpc.admin.about.get.queryOptions({ input: {} }),
}
