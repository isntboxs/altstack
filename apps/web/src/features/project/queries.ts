import { useSuspenseQuery } from '@tanstack/react-query'

import type { SearchSortType } from '@altstack/shared/schemas'

import { projectORPC } from '@/utils/orpc'

export interface SearchProjectsParams {
	page?: number
	sort?: SearchSortType
	category?: string
	q?: string
}

export const projectQueries = {
	bySlug: (slug: string) =>
		projectORPC.getBySlug.queryOptions({ input: { slug } }),
	search: (params: SearchProjectsParams) =>
		projectORPC.search.queryOptions({ input: params }),
	listCategories: () => projectORPC.listCategories.queryOptions({ input: {} }),
}

export const useProjectBySlug = (slug: string) =>
	useSuspenseQuery(projectQueries.bySlug(slug))

export const useProjectSearch = (params: SearchProjectsParams) =>
	useSuspenseQuery(projectQueries.search(params))
