import { queryOptions } from '@tanstack/react-query'

import type { ORPCRouterInputs } from '@altstack/api/routers'

import { client } from '#/utils/orpc'

export const adminDashboardKey = ['admin-dashboard'] as const
export const dashboardQueries = {
	overview: (userId: string) =>
		queryOptions({
			queryKey: [...adminDashboardKey, userId, 'overview'],
			queryFn: () => client.admin.dashboard.overview({}),
			staleTime: 30_000,
			refetchInterval: 60_000,
			retry: false,
		}),
	operations: (userId: string) =>
		queryOptions({
			queryKey: [...adminDashboardKey, userId, 'operations'],
			queryFn: () => client.admin.dashboard.operations({}),
			staleTime: 30_000,
			refetchInterval: 60_000,
			retry: false,
		}),
	activity: (
		userId: string,
		query: ORPCRouterInputs['admin']['dashboard']['activity']['query']
	) =>
		queryOptions({
			queryKey: [...adminDashboardKey, userId, 'activity', query],
			queryFn: () => client.admin.dashboard.activity({ query }),
			retry: false,
		}),
}
