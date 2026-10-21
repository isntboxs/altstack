import { openapi } from '@orpc/openapi'

import { publicContract } from '@altstack/api/contracts/base'

import { ORPC_ERRORS } from '@altstack/shared/constants/orpc-errors'
import {
	createReportInputSchema,
	createReportOutputSchema,
} from '@altstack/shared/schemas/report'
import { submissionRateLimitDataSchema } from '@altstack/shared/schemas/submission'

export const reportContract = {
	create: publicContract
		.errors({
			TOO_MANY_REQUESTS: {
				...ORPC_ERRORS.TOO_MANY_REQUESTS,
				data: submissionRateLimitDataSchema.optional(),
			},
		})
		.meta(
			openapi({
				path: '/projects/{id}/reports',
				method: 'POST',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				paramsStyles: { id: 'primitive' },
				successStatus: 201,
				summary: 'Privately report an issue with a published project',
				tags: ['Reports'],
				operationId: 'createProjectReport',
			})
		)
		.input(createReportInputSchema)
		.output(createReportOutputSchema),
}
