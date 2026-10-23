import { orpc } from '#/utils/orpc'

export const licenseQueries = {
	list: () => orpc.license.list.queryOptions({ input: {} }),
	get: (slug: string) =>
		orpc.license.getBySlug.queryOptions({ input: { params: { slug } } }),
}
