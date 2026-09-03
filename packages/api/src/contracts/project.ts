import { openapi } from '@orpc/openapi'

import { baseContract } from '@altstack/api/contracts/base'

import {
	getProjectBySlugInputSchema,
	getProjectBySlugOutputSchema,
	listProjectsInputSchema,
	listProjectsOutputSchema,
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

export const projectContract = {
	getBySlug: getBySlugContract,
	list: listProjectsContract,
}
