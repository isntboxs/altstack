import { openapi } from '@orpc/openapi'

import { baseContract } from '@altstack/api/contracts/base'

import {
	changeLogoUploadInputSchema,
	changeLogoUploadOutputSchema,
	changeScreenshotUploadInputSchema,
	changeScreenshotUploadOutputSchema,
	removeLogoUploadInputSchema,
	removeLogoUploadOutputSchema,
	removeScreenshotUploadInputSchema,
	removeScreenshotUploadOutputSchema,
	requestLogoUploadInputSchema,
	requestLogoUploadOutputSchema,
	requestScreenshotUploadInputSchema,
	requestScreenshotUploadOutputSchema,
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

const changeLogoUploadContract = baseContract
	.meta(
		openapi({
			path: '/admin/uploads/logo/change',
			method: 'POST',
			summary: 'Change logo upload',
			tags: ['AdminUploads'],
			operationId: 'changeLogoUpload',
			successStatus: 200,
			successDescription: 'Logo changed',
		})
	)
	.input(changeLogoUploadInputSchema)
	.output(changeLogoUploadOutputSchema)

const requestScreenshotUploadContract = baseContract
	.meta(
		openapi({
			path: '/admin/uploads/screenshot',
			method: 'POST',
			summary: 'Request screenshot upload URL',
			tags: ['AdminUploads'],
			operationId: 'requestScreenshotUpload',
			successStatus: 200,
			successDescription: 'Presigned URL issued',
		})
	)
	.input(requestScreenshotUploadInputSchema)
	.output(requestScreenshotUploadOutputSchema)

const removeScreenshotUploadContract = baseContract
	.meta(
		openapi({
			path: '/admin/uploads/screenshot',
			method: 'DELETE',
			summary: 'Remove screenshot upload',
			tags: ['AdminUploads'],
			operationId: 'removeScreenshotUpload',
			successStatus: 200,
			successDescription: 'Screenshot removed',
		})
	)
	.input(removeScreenshotUploadInputSchema)
	.output(removeScreenshotUploadOutputSchema)

const changeScreenshotUploadContract = baseContract
	.meta(
		openapi({
			path: '/admin/uploads/screenshot/change',
			method: 'POST',
			summary: 'Change screenshot upload',
			tags: ['AdminUploads'],
			operationId: 'changeScreenshotUpload',
			successStatus: 200,
			successDescription: 'Screenshot changed',
		})
	)
	.input(changeScreenshotUploadInputSchema)
	.output(changeScreenshotUploadOutputSchema)

export const uploadContract = {
	logo: {
		request: requestLogoUploadContract,
		remove: removeLogoUploadContract,
		change: changeLogoUploadContract,
	},
	screenshot: {
		request: requestScreenshotUploadContract,
		remove: removeScreenshotUploadContract,
		change: changeScreenshotUploadContract,
	},
} as const
