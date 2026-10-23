import { openapi } from '@orpc/openapi'
import { z } from 'zod'

import { publicContract } from '@altstack/api/contracts/base'

import {
	getLicenseInputSchema,
	getLicenseOutputSchema,
	listLicensesOutputSchema,
} from '@altstack/shared/schemas/license'

export const licenseContract = {
	list: publicContract
		.meta(
			openapi({
				path: '/licenses',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				tags: ['Licenses'],
				operationId: 'listLicenses',
				summary: 'Browse licenses used by published projects',
			})
		)
		.input(z.object({}))
		.output(listLicensesOutputSchema),
	getBySlug: publicContract
		.meta(
			openapi({
				path: '/licenses/{slug}',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				tags: ['Licenses'],
				operationId: 'getLicense',
				summary: 'Get a license with published projects',
			})
		)
		.input(getLicenseInputSchema)
		.output(getLicenseOutputSchema),
}
