import type { ORPCRouterInputs } from '@altstack/api/routers'

import { categoryORPC } from '#/utils/orpc'

export const categoryQueries = {
	list: () => categoryORPC.list.queryOptions({ input: {} }),
	getByPath: (input: ORPCRouterInputs['category']['getByPath']) =>
		categoryORPC.getByPath.queryOptions({ input }),
}
