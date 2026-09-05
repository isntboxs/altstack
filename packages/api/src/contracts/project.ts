import { openapi } from '@orpc/openapi'

import { baseContract } from '@altstack/api/contracts/base'

import {
	getProjectBySlugInputSchema,
	getProjectBySlugOutputSchema,
	listCategoriesInputSchema,
	listCategoriesOutputSchema,
	listProjectsInputSchema,
	listProjectsOutputSchema,
	searchProjectsInputSchema,
	searchProjectsOutputSchema,
} from '@altstack/shared/schemas/project'

const getBySlugContract = baseContract
	.meta(
		openapi({
			path: '/projects/{slug}',
			method: 'GET',
			summary: 'Get project by slug',
			description: 'Get project by slug.',
			tags: ['Projects'],
			operationId: 'getProjectBySlug',
			successStatus: 200,
			successDescription: 'Project found',
		})
	)
	.input(getProjectBySlugInputSchema)
	.output(getProjectBySlugOutputSchema)

const listProjectsContract = baseContract
	.meta(
		openapi({
			path: '/projects',
			method: 'GET',
			summary: 'List projects',
			description: 'List projects. Paginated list of projects.',
			tags: ['Projects'],
			operationId: 'listProjects',
			successStatus: 200,
			successDescription: 'Projects listed',
		})
	)
	.input(listProjectsInputSchema)
	.output(listProjectsOutputSchema)

const searchProjectsContract = baseContract
	.meta(
		openapi({
			path: '/projects/search',
			method: 'GET',
			summary: 'Search projects',
			description:
				'Search published projects by text query, category, sort, and pagination.',
			tags: ['Projects'],
			operationId: 'searchProjects',
			successStatus: 200,
			successDescription: 'Projects found',
		})
	)
	.input(searchProjectsInputSchema)
	.output(searchProjectsOutputSchema)

const listCategoriesContract = baseContract
	.meta(
		openapi({
			path: '/categories',
			method: 'GET',
			summary: 'List categories',
			description:
				'List categories attached to published projects, ordered by name.',
			tags: ['Projects'],
			operationId: 'listCategories',
			successStatus: 200,
			successDescription: 'Categories listed',
		})
	)
	.input(listCategoriesInputSchema)
	.output(listCategoriesOutputSchema)

export const projectContract = {
	getBySlug: getBySlugContract,
	list: listProjectsContract,
	search: searchProjectsContract,
	listCategories: listCategoriesContract,
}
