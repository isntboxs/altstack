import type { ORPCRouterInputs } from '@altstack/api/routers'

import { orpc } from '#/utils/orpc'

export const tagQueries = {
	list: (query: ORPCRouterInputs['tag']['list']['query']) =>
		orpc.tag.list.queryOptions({ input: { query } }),
	get: (slug: string) =>
		orpc.tag.getBySlug.queryOptions({ input: { params: { slug } } }),
}
