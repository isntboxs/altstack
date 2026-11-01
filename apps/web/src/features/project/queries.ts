import { useSuspenseQuery } from '@tanstack/react-query'

import type { SearchSortType } from '@altstack/shared/schemas'

import { catalogueOffset } from '#/features/ads/selection'
import { projectORPC } from '#/utils/orpc'

export function projectCatalogueKey(params: SearchProjectsParams) {
	return JSON.stringify([
		'projects',
		params.category ?? '',
		params.tag ?? '',
		params.license ?? '',
		params.q ?? '',
		params.sort ?? 'newest',
	])
}

export interface SearchProjectsParams {
	page?: number
	sort?: SearchSortType
	category?: string
	tag?: string
	license?: string
	q?: string
}

export const projectQueries = {
	bySlug: (slug: string) =>
		projectORPC.getBySlug.queryOptions({ input: { params: { slug } } }),
	search: (params: SearchProjectsParams) =>
		projectORPC.search.queryOptions({
			input: {
				query: {
					...params,
					limit: 45,
					offset: catalogueOffset(
						projectCatalogueKey(params),
						params.page ?? 1
					),
				},
			},
		}),
	listCategories: () => projectORPC.listCategories.queryOptions({ input: {} }),
}

export const useProjectBySlug = (slug: string) =>
	useSuspenseQuery(projectQueries.bySlug(slug))

export const useProjectSearch = (params: SearchProjectsParams) =>
	useSuspenseQuery(projectQueries.search(params))
