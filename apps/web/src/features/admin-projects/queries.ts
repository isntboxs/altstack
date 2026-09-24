import { useSuspenseQuery } from '@tanstack/react-query'

import type { ProjectStatus } from '@altstack/shared'

import { adminORPC } from '@/utils/orpc'

export const adminProjectQueries = {
	list: (
		input: { page?: number; limit?: number; status?: ProjectStatus } = {}
	) => adminORPC.project.list.queryOptions({ input }),
	listCategories: () =>
		adminORPC.project.listCategories.queryOptions({ input: {} }),
}

export const useAdminProjectList = (
	input?: Parameters<typeof adminProjectQueries.list>[0]
) => useSuspenseQuery(adminProjectQueries.list(input))
