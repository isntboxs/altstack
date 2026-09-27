import { openapi } from '@orpc/openapi'

import { baseContract } from '@altstack/api/contracts/base'

import {
	removeLogoUploadInputSchema,
	removeLogoUploadOutputSchema,
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

const removeLogoUploadContract = baseContract
	.meta(
		openapi({
			path: '/admin/uploads/logo',
			method: 'DELETE',
			summary: 'Remove logo upload',
			tags: ['AdminUploads'],
			operationId: 'removeLogoUpload',
			successStatus: 200,
			successDescription: 'Logo removed',
		})
	)
	.input(removeLogoUploadInputSchema)
	.output(removeLogoUploadOutputSchema)

export const uploadContract = {
	logo: {
		request: requestLogoUploadContract,
		remove: removeLogoUploadContract,
	},
} as const
