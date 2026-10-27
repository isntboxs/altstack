import { openapi } from '@orpc/openapi'
import { z } from 'zod'

import { baseContract } from '@altstack/api/contracts/base'

import {
	adminActivityQuerySchema,
	adminActivitySchema,
	adminOperationsSchema,
	adminOverviewSchema,
} from '@altstack/shared/schemas/admin-dashboard'

const endpoint = (path: `/${string}`, operationId: string) =>
	baseContract.meta(
		openapi({
			path,
			method: 'QUERY',
			operationId,
			tags: ['AdminDashboard'],
			inputStructure: 'detailed',
			outputStructure: 'compact',
		})
	)

export const adminDashboardContract = {
	overview: endpoint('/admin/dashboard', 'getAdminOverview')
		.input(z.object({}))
		.output(adminOverviewSchema),
	activity: endpoint('/admin/activity', 'listAdminActivity')
		.input(z.object({ query: adminActivityQuerySchema }))
		.output(adminActivitySchema),
	operations: endpoint('/admin/operations', 'getAdminOperations')
		.input(z.object({}))
		.output(adminOperationsSchema),
}
