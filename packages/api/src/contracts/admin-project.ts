import { openapi } from '@orpc/openapi'

import { baseContract } from '@altstack/api/contracts/base'

import {
	adminListProjectInputSchema,
	adminListProjectOutputSchema,
} from '@altstack/shared'

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
	list: listAdminProjectsContract,
} as const
