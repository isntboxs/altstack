import { queryOptions } from '@tanstack/react-query'

import type { ORPCRouterInputs } from '@altstack/api/routers'

import { client } from '#/utils/orpc'

export const adminUsersKey = ['admin-users'] as const
export const adminUserQueries = {
	list: (
		actorId: string,
		query: ORPCRouterInputs['admin']['user']['list']['query']
	) =>
		queryOptions({
			queryKey: [...adminUsersKey, 'list', actorId, query],
			queryFn: () => client.admin.user.list({ query }),
			retry: false,
		}),
	get: (actorId: string, id: string) =>
		queryOptions({
			queryKey: [...adminUsersKey, 'get', actorId, id],
			queryFn: () => client.admin.user.get({ params: { id } }),
			retry: false,
		}),
}
