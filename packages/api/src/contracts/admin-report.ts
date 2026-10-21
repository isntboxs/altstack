import { openapi } from '@orpc/openapi'

import { baseContract } from '@altstack/api/contracts/base'

import {
	adminListReportsInputSchema,
	adminListReportsOutputSchema,
	adminModerateReportInputSchema,
	adminModerateReportOutputSchema,
} from '@altstack/shared/schemas/admin-report'

export const adminReportContract = {
	list: baseContract
		.meta(
			openapi({
				path: '/admin/reports',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				summary: 'Admin list private project reports, newest first',
				tags: ['AdminReports'],
				operationId: 'listAdminReports',
			})
		)
		.input(adminListReportsInputSchema)
		.output(adminListReportsOutputSchema),
	moderate: baseContract
		.meta(
			openapi({
				path: '/admin/reports/{id}',
				method: 'PATCH',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				paramsStyles: { id: 'primitive' },
				summary: 'Admin resolve or dismiss an open report',
				tags: ['AdminReports'],
				operationId: 'moderateAdminReport',
			})
		)
		.input(adminModerateReportInputSchema)
		.output(adminModerateReportOutputSchema),
}
