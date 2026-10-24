import { z } from 'zod'

import { adminUpdateProjectBodySchema } from '@altstack/shared/schemas/admin-project'
import { categoryNodeSchema } from '@altstack/shared/schemas/category'
import {
	paginationSchema,
	projectSchema,
} from '@altstack/shared/schemas/common'
import {
	logoKeySchema,
	screenshotKeySchema,
	requestLogoUploadBodySchema,
	requestScreenshotUploadBodySchema,
} from '@altstack/shared/schemas/upload'

export const projectMemberRoleSchema = z.enum(['owner', 'maintainer'])
export const claimStatusSchema = z.enum([
	'email_pending',
	'pending',
	'approved',
	'rejected',
])
export const managedProjectParamsSchema = z.strictObject({ id: z.uuid() })
export const claimGithubEvidenceSchema = z.object({
	status: z.enum([
		'verified',
		'limited',
		'denied',
		'unavailable',
		'disconnected',
	]),
	permission: z.enum([
		'admin',
		'maintain',
		'write',
		'read',
		'triage',
		'none',
		'unknown',
	]),
	reason: z
		.enum([
			'account_required',
			'reconnect',
			'github_unavailable',
			'insufficient_access',
			'identity_mismatch',
			'repository_changed',
		])
		.nullable(),
	githubUserId: z.string().nullable(),
	login: z.string().max(100).nullable(),
	repositoryId: z.string().nullable(),
	checkedAt: z.iso.datetime(),
})
export type ClaimGithubEvidence = z.infer<typeof claimGithubEvidenceSchema>
export const claimBodySchema = z.strictObject({
	email: z
		.email()
		.trim()
		.max(254)
		.transform((email) => email.toLowerCase()),
	role: projectMemberRoleSchema,
})
export const claimRequestInputSchema = z.object({
	params: managedProjectParamsSchema,
	body: claimBodySchema,
})
export const claimChallengeSchema = z.object({
	challengeId: z.uuid(),
	expiresAt: z.coerce.date(),
	resendAt: z.coerce.date(),
})
export const claimVerifyInputSchema = z.object({
	params: managedProjectParamsSchema,
	body: z.strictObject({
		challengeId: z.uuid(),
		code: z.string().regex(/^\d{6}$/, 'Enter the six-digit code.'),
	}),
})
export const claimStateSchema = z.object({
	membership: projectMemberRoleSchema.nullable(),
	claim: z
		.object({
			status: claimStatusSchema,
			role: projectMemberRoleSchema,
			email: z.string(),
			challenge: claimChallengeSchema.nullable(),
			githubEvidence: claimGithubEvidenceSchema.nullable(),
		})
		.nullable(),
})
export const managedProjectSchema = projectSchema
	.omit({ categories: true })
	.extend({
		revision: z.string(),
		categorySlugs: z.array(z.string()),
	})
// Keep the canonical repository, slug, visibility, Featured selection and
// provenance under admin control. Shared validators still enforce copy/media.
const editable = adminUpdateProjectBodySchema.shape
export const memberProjectUpdateBodySchema = z.strictObject({
	name: editable.name,
	tagline: editable.tagline,
	description: editable.description,
	websiteUrl: editable.websiteUrl,
	content: editable.content,
	categorySlugs: editable.categorySlugs,
	logo: editable.logo,
	screenshot: editable.screenshot,
	revision: z.string().min(1).max(30),
})
export const memberProjectUpdateInputSchema = z.object({
	params: managedProjectParamsSchema,
	body: memberProjectUpdateBodySchema,
})
export const ownershipListInputSchema = z.object({
	query: z.object({
		page: z.coerce.number().int().min(1).max(1000000).default(1),
		limit: z.coerce.number().int().min(1).max(50).default(25),
	}),
})
export const ownershipListOutputSchema = z.object({
	projects: z.array(
		z.object({
			id: z.uuid(),
			name: z.string(),
			slug: z.string(),
			role: projectMemberRoleSchema,
		})
	),
	pagination: paginationSchema,
})
export const claimInboxOutputSchema = z.object({
	claims: z.array(
		z.object({
			id: z.uuid(),
			projectId: z.uuid(),
			projectName: z.string(),
			projectSlug: z.string(),
			name: z.string(),
			email: z.string(),
			role: projectMemberRoleSchema,
			requestedAt: z.coerce.date(),
			githubEvidence: claimGithubEvidenceSchema.nullable(),
		})
	),
	pagination: paginationSchema,
})
export const claimReviewInputSchema = z.object({
	params: z.strictObject({ id: z.uuid() }),
	body: z.strictObject({
		decision: z.enum(['approve', 'reject']),
		manualEvidence: z.string().trim().min(20).max(1000).optional(),
	}),
})
export const memberCategoriesOutputSchema = z.object({
	categories: z.array(categoryNodeSchema),
})
export const memberUploadInputSchema = z.object({
	params: managedProjectParamsSchema,
	body: z.discriminatedUnion('kind', [
		requestLogoUploadBodySchema.extend({ kind: z.literal('logo') }).strict(),
		requestScreenshotUploadBodySchema
			.extend({ kind: z.literal('screenshot') })
			.strict(),
	]),
})
export const memberUploadRemoveInputSchema = z.object({
	params: managedProjectParamsSchema,
	body: z.strictObject({ key: z.union([logoKeySchema, screenshotKeySchema]) }),
})
