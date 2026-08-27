import { z } from 'zod'

import { baseContract } from '@altstack/api/contracts/base'

const createProjectContract = baseContract
	.route({
		path: '/projects',
		method: 'POST',
		summary: 'Create a new project',
		description: 'Create a new project.',
		tags: ['Project'],
		operationId: 'createProject',
		successStatus: 200,
		successDescription: 'Project created successfully',
	})
	.input(
		z.object({
			name: z.string().nonempty(),
			repositoryUrl: z.url().nonempty(),
			websiteUrl: z.url().optional(),
			tagline: z.string().nonempty().max(80),
			shortDescription: z.string().nonempty().max(280),
			logoUrl: z.url().nonempty(),
		})
	)

export const projectContract = {
	create: createProjectContract,
}
