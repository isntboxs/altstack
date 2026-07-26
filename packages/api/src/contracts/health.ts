import { z } from 'zod'

import { baseContract } from '@altstack/api/contracts/base'

export const healthContract = baseContract
	.route({
		path: '/health',
		method: 'GET',
		summary: 'Check server health',
		description: 'Check if the server is healthy.',
		tags: ['Health'],
		operationId: 'checkHealth',
		successStatus: 200,
		successDescription: 'Server is healthy',
	})
	.output(
		z.object({
			message: z.string(),
		})
	)
