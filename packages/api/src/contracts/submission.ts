import { openapi } from '@orpc/openapi'

import { baseContract } from '@altstack/api/contracts/base'

import {
	createSubmissionInputSchema,
	createSubmissionOutputSchema,
	listSubmissionsOutputSchema,
} from '@altstack/shared'

const createSubmissionContract = baseContract
	.meta(
		openapi({
			path: '/submissions',
			method: 'POST',
			summary: 'Create submission',
			description: 'Create a new submission.',
			tags: ['Submissions'],
			operationId: 'createSubmission',
			successStatus: 201,
			successDescription: 'Submission created',
		})
	)
	.input(createSubmissionInputSchema)
	.output(createSubmissionOutputSchema)

const listSubmissionsContract = baseContract
	.meta(
		openapi({
			path: '/submissions',
			method: 'GET',
			summary: 'List submissions',
			description: 'List submissions.',
			tags: ['Submissions'],
			operationId: 'listSubmissions',
			successStatus: 200,
			successDescription: 'Submissions listed',
		})
	)
	.output(listSubmissionsOutputSchema)

export const submissionContract = {
	create: createSubmissionContract,
	list: listSubmissionsContract,
}
