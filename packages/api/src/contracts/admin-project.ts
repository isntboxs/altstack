import { openapi } from '@orpc/openapi'

import { baseContract } from '@altstack/api/contracts/base'

import {
	adminCreateProjectInputSchema,
	adminCreateProjectOutputSchema,
	adminListProjectInputSchema,
	adminListProjectOutputSchema,
} from '@altstack/shared'

const createAdminProjectContract = baseContract
	.meta(
		openapi({
			path: '/admin/projects',
			method: 'POST',
			summary: 'Admin create project',
			description:
				'Create project directly as published. Duplicate repo/slug → 409.',
			tags: ['AdminProjects'],
			operationId: 'createAdminProject',
			successStatus: 201,
			successDescription: 'Project created',
		})
	)
	.input(adminCreateProjectInputSchema)
	.output(adminCreateProjectOutputSchema)

const listAdminProjectsContract = baseContract
	.meta(
		openapi({
			path: '/admin/projects',
			method: 'GET',
			summary: 'Admin list projects',
			description: 'Paginated list with optional status filter.',
			tags: ['AdminProjects'],
			operationId: 'listAdminProjects',
			successStatus: 200,
			successDescription: 'Projects listed',
		})
	)
	.input(adminListProjectInputSchema)
	.output(adminListProjectOutputSchema)

export const adminProjectContract = {
	create: createAdminProjectContract,
	list: listAdminProjectsContract,
} as const
