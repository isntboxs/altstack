import { openapi } from '@orpc/openapi'
import { z } from 'zod'

import { aboutPageSchema, aboutUpdateSchema } from '@altstack/shared/schemas'

import { baseContract, publicContract } from './base'

export const aboutContract = {
	get: publicContract
		.meta(
			openapi({
				path: '/about',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				operationId: 'getAbout',
				tags: ['About'],
			})
		)
		.input(z.object({}))
		.output(aboutPageSchema),
}

export const adminAboutContract = {
	get: baseContract
		.meta(
			openapi({
				path: '/admin/about',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				operationId: 'getAdminAbout',
				tags: ['About'],
			})
		)
		.input(z.object({}))
		.output(aboutPageSchema),
	update: baseContract
		.meta(
			openapi({
				path: '/admin/about',
				method: 'PUT',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				operationId: 'updateAbout',
				tags: ['About'],
			})
		)
		.input(z.object({ body: aboutUpdateSchema }))
		.output(aboutPageSchema),
}
