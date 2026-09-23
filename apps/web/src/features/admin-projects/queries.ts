import { useSuspenseQuery } from '@tanstack/react-query'

import { adminORPC } from '@/utils/orpc'

export const adminProjectQueries = {
	list: () => adminORPC.project.list.queryOptions({ input: {} }),
}

export const useAdminProjectList = () =>
	useSuspenseQuery(adminProjectQueries.list())
