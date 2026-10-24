import { openapi } from '@orpc/openapi'
import { z } from 'zod'

import { baseContract } from '@altstack/api/contracts/base'

import {
	claimRequestInputSchema,
	claimChallengeSchema,
	claimVerifyInputSchema,
	claimStateSchema,
	managedProjectParamsSchema,
	managedProjectSchema,
	memberProjectUpdateInputSchema,
	ownershipListInputSchema,
	ownershipListOutputSchema,
	claimInboxOutputSchema,
	claimReviewInputSchema,
	memberCategoriesOutputSchema,
	memberUploadInputSchema,
	memberUploadRemoveInputSchema,
} from '@altstack/shared/schemas/ownership'

const endpoint = (
	path: `/${string}`,
	method: 'QUERY' | 'POST' | 'PATCH' | 'DELETE',
	operationId: string
) =>
	baseContract
		.errors({
			SERVICE_UNAVAILABLE: {
				message: 'Service temporarily unavailable. Please try again later.',
				status: 503,
			},
		})
		.meta(
			openapi({
				path,
				method,
				operationId,
				tags: ['ProjectOwnership'],
				inputStructure: 'detailed',
				outputStructure: 'compact',
				paramsStyles: path.includes('{id}') ? { id: 'primitive' } : undefined,
				queryStyles:
					path === '/managed-projects' || path === '/project-claims'
						? { page: 'primitive', limit: 'primitive' }
						: undefined,
			})
		)
const params = z.object({ params: managedProjectParamsSchema })
const success = z.object({ success: z.literal(true) })
export const ownershipContract = {
	request: endpoint('/projects/{id}/claim', 'POST', 'requestProjectClaim')
		.input(claimRequestInputSchema)
		.output(claimChallengeSchema),
	verify: endpoint(
		'/projects/{id}/claim/verify',
		'POST',
		'verifyProjectClaimEmail'
	)
		.input(claimVerifyInputSchema)
		.output(success),
	state: endpoint('/projects/{id}/claim', 'QUERY', 'getOwnProjectClaim')
		.input(params)
		.output(claimStateSchema),
	list: endpoint('/managed-projects', 'QUERY', 'listManagedProjects')
		.input(ownershipListInputSchema)
		.output(ownershipListOutputSchema),
	inbox: endpoint('/project-claims', 'QUERY', 'listReviewableClaims')
		.input(ownershipListInputSchema)
		.output(claimInboxOutputSchema),
	review: endpoint('/project-claims/{id}', 'POST', 'reviewProjectClaim')
		.input(claimReviewInputSchema)
		.output(success),
	get: endpoint('/managed-projects/{id}', 'QUERY', 'getManagedProject')
		.input(params)
		.output(managedProjectSchema),
	update: endpoint('/managed-projects/{id}', 'PATCH', 'updateManagedProject')
		.input(memberProjectUpdateInputSchema)
		.output(success),
	categories: endpoint(
		'/managed-projects/{id}/categories',
		'QUERY',
		'listManagedProjectCategories'
	)
		.input(params)
		.output(memberCategoriesOutputSchema),
	upload: endpoint(
		'/managed-projects/{id}/uploads',
		'POST',
		'requestManagedProjectUpload'
	)
		.input(memberUploadInputSchema)
		.output(z.object({ key: z.string(), presignedUrl: z.url() })),
	removeUpload: endpoint(
		'/managed-projects/{id}/uploads',
		'DELETE',
		'removeManagedProjectUpload'
	)
		.input(memberUploadRemoveInputSchema)
		.output(success),
}
