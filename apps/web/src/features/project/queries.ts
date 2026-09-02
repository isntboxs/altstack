import { useSuspenseQuery } from '@tanstack/react-query'

import { projectORPC } from '@/utils/orpc'

export const projectQueries = {
	bySlug: (slug: string) =>
		projectORPC.getBySlug.queryOptions({ input: { slug } }),
	list: ({ limit, page }: { limit?: number; page?: number }) =>
		projectORPC.list.queryOptions({ input: { limit, page } }),
}

export const useProjectBySlug = (slug: string) =>
	useSuspenseQuery(projectQueries.bySlug(slug))

export const useProjectList = ({
	limit,
	page,
}: {
	limit?: number
	page?: number
}) => useSuspenseQuery(projectQueries.list({ limit, page }))
