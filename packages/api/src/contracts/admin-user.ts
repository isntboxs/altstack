import { openapi } from '@orpc/openapi'
import { z } from 'zod'

import { baseContract } from '@altstack/api/contracts/base'

import {
	adminUserActionInputSchema,
	adminUserGetInputSchema,
	adminUserGetOutputSchema,
	adminUserListInputSchema,
	adminUserListOutputSchema,
} from '@altstack/shared/schemas/admin-user'

const endpoint = (
	path: `/${string}`,
	method: 'QUERY' | 'POST',
	operationId: string
) =>
	baseContract.meta(
		openapi({
			path,
			method,
			operationId,
			tags: ['AdminUsers'],
			inputStructure: 'detailed',
			outputStructure: 'compact',
			paramsStyles: path.includes('{id}') ? { id: 'primitive' } : undefined,
			queryStyles:
				path === '/admin/users'
					? {
							q: 'primitive',
							role: 'primitive',
							status: 'primitive',
							page: 'primitive',
						}
					: undefined,
		})
	)
export const adminUserContract = {
	list: endpoint('/admin/users', 'QUERY', 'listAdminUsers')
		.input(adminUserListInputSchema)
		.output(adminUserListOutputSchema),
	get: endpoint('/admin/users/{id}', 'QUERY', 'getAdminUser')
		.input(adminUserGetInputSchema)
		.output(adminUserGetOutputSchema),
	action: endpoint('/admin/users/{id}/actions', 'POST', 'manageAdminUser')
		.input(adminUserActionInputSchema)
		.output(z.object({ success: z.literal(true) })),
}
