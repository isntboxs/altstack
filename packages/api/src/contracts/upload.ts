import { openapi } from '@orpc/openapi'

import { baseContract } from '@altstack/api/contracts/base'

import {
	requestLogoUploadInputSchema,
	requestLogoUploadOutputSchema,
} from '@altstack/shared'

const requestLogoUploadContract = baseContract
	.meta(
		openapi({
			path: '/admin/uploads/logo',
			method: 'POST',
			summary: 'Request logo upload URL',
			tags: ['AdminUploads'],
			operationId: 'requestLogoUpload',
			successStatus: 200,
			successDescription: 'Presigned URL issued',
		})
	)
	.input(requestLogoUploadInputSchema)
	.output(requestLogoUploadOutputSchema)

export const uploadContract = {
	logo: {
		request: requestLogoUploadContract,
	},
} as const
