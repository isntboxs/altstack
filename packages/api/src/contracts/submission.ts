import { openapi } from '@orpc/openapi'

import { baseContract } from '@altstack/api/contracts/base'

import { ORPC_ERRORS } from '@altstack/shared/constants/orpc-errors'
import {
	createSubmissionInputSchema,
	createSubmissionOutputSchema,
	listSubmissionInputSchema,
	listSubmissionOutputSchema,
	submissionRateLimitDataSchema,
} from '@altstack/shared/schemas/submission'

export const submissionContract = {
	list: baseContract
		.meta(
			openapi({
				path: '/submissions',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				summary: 'List your own submissions',
				tags: ['Submissions'],
				operationId: 'listMySubmissions',
				queryStyles: { q: 'primitive', page: 'primitive', limit: 'primitive' },
			})
		)
		.input(listSubmissionInputSchema)
		.output(listSubmissionOutputSchema),
	create: baseContract
		.errors({
			TOO_MANY_REQUESTS: {
				...ORPC_ERRORS.TOO_MANY_REQUESTS,
				data: submissionRateLimitDataSchema.optional(),
			},
		})
		.meta(
			openapi({
				path: '/submissions',
				method: 'POST',
				inputStructure: 'compact',
				outputStructure: 'compact',
				summary: 'Submit a public GitHub project for review',
				tags: ['Submissions'],
				operationId: 'createSubmission',
				successStatus: 201,
			})
		)
		.input(createSubmissionInputSchema)
		.output(createSubmissionOutputSchema),
}
