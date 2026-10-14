import { openapi } from '@orpc/openapi'

import { baseContract } from '@altstack/api/contracts/base'

import { ORPC_ERRORS } from '@altstack/shared/constants/orpc-errors'
import {
	createSubmissionInputSchema,
	createSubmissionOutputSchema,
	getSubmissionInputSchema,
	getSubmissionOutputSchema,
	listSubmissionInputSchema,
	listSubmissionOutputSchema,
	resubmitSubmissionInputSchema,
	resubmitSubmissionOutputSchema,
	submissionRateLimitDataSchema,
} from '@altstack/shared/schemas/submission'

export const submissionContract = {
	getById: baseContract
		.meta(
			openapi({
				path: '/submissions/{id}',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				paramsStyles: { id: 'primitive' },
				summary: 'Read your rejected intake for correction',
				tags: ['Submissions'],
				operationId: 'getMyRejectedSubmission',
			})
		)
		.input(getSubmissionInputSchema)
		.output(getSubmissionOutputSchema),
	resubmit: baseContract
		.errors({
			TOO_MANY_REQUESTS: {
				...ORPC_ERRORS.TOO_MANY_REQUESTS,
				data: submissionRateLimitDataSchema.optional(),
			},
		})
		.meta(
			openapi({
				path: '/submissions/{id}/resubmit',
				method: 'POST',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				paramsStyles: { id: 'primitive' },
				summary: 'Correct your rejected intake and return it to review',
				tags: ['Submissions'],
				operationId: 'resubmitSubmission',
			})
		)
		.input(resubmitSubmissionInputSchema)
		.output(resubmitSubmissionOutputSchema),
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
