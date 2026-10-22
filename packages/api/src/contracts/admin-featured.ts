import { openapi } from '@orpc/openapi'
import { z } from 'zod'

import { baseContract } from '@altstack/api/contracts/base'

import {
	adminFeaturedListOutputSchema,
	adminFeaturedUpdateInputSchema,
} from '@altstack/shared/schemas/featured'

export const adminFeaturedContract = {
	list: baseContract
		.meta(
			openapi({
				path: '/admin/featured-projects',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				summary: 'Admin list the ordered featured project selection',
				tags: ['AdminFeaturedProjects'],
				operationId: 'listAdminFeaturedProjects',
			})
		)
		.input(z.object({}))
		.output(adminFeaturedListOutputSchema),
	update: baseContract
		.meta(
			openapi({
				path: '/admin/featured-projects',
				method: 'PUT',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				summary: 'Admin replace the ordered featured project selection',
				tags: ['AdminFeaturedProjects'],
				operationId: 'updateAdminFeaturedProjects',
			})
		)
		.input(adminFeaturedUpdateInputSchema)
		.output(adminFeaturedListOutputSchema),
}
