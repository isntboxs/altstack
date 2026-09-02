import { useSuspenseQuery } from '@tanstack/react-query'

import { projectORPC } from '@/utils/orpc'

export const projectQueries = {
	bySlug: (slug: string) =>
		projectORPC.getBySlug.queryOptions({ input: { slug } }),
}

export const useProjectBySlug = (slug: string) =>
	useSuspenseQuery(projectQueries.bySlug(slug))
