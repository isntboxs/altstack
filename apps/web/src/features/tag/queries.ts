import type { ORPCRouterInputs } from '@altstack/api/routers'

import { orpc } from '#/utils/orpc'

export const tagQueries = {
	/** Keys directory requests by their filters and pagination for cache isolation. */
	list: (query: ORPCRouterInputs['tag']['list']['query']) =>
		orpc.tag.list.queryOptions({ input: { query } }),
	/** Fetches a public tag by its stable GitHub topic slug. */
	get: (slug: string) =>
		orpc.tag.getBySlug.queryOptions({ input: { params: { slug } } }),
}
