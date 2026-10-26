import { z } from 'zod'

import { paginationSchema } from '@altstack/shared/schemas/common'
import { projectMemberRoleSchema } from '@altstack/shared/schemas/ownership'

export const adminUserSearchSchema = z.object({
	q: z.string().trim().max(200).optional().catch(''),
	role: z
		.enum(['all', 'admin', 'user', 'owner', 'maintainer'])
		.optional()
		.catch('all'),
	status: z.enum(['all', 'active', 'banned']).optional().catch('all'),
	page: z.coerce.number().int().min(1).max(1000000).optional().catch(1),
})
export const adminUserSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	email: z.string(),
	emailVerified: z.boolean(),
	role: z.string(),
	banned: z.boolean(),
	banReason: z.string().nullable(),
	banExpires: z.coerce.date().nullable(),
	createdAt: z.coerce.date(),
	revision: z.string().min(1).max(30),
})
export const adminUserListInputSchema = z.object({
	query: adminUserSearchSchema,
})
export const adminUserListOutputSchema = z.object({
	users: z.array(adminUserSchema),
	pagination: paginationSchema,
})
export const adminUserGetInputSchema = z.object({
	params: z.strictObject({ id: z.uuid() }),
})
export const adminUserGetOutputSchema = z.object({
	user: adminUserSchema,
	providers: z.array(z.string()),
	activeSessions: z.number().int(),
	memberships: z.array(
		z.object({
			projectId: z.uuid(),
			projectName: z.string(),
			status: z.string(),
			role: projectMemberRoleSchema,
		})
	),
})
const revision = { revision: z.string().min(1).max(30) }
export const adminUserActionInputSchema = adminUserGetInputSchema.extend({
	body: z.discriminatedUnion('action', [
		z.strictObject({
			...revision,
			action: z.literal('set-role'),
			role: z.enum(['admin', 'user']),
		}),
		z.strictObject({
			...revision,
			action: z.literal('ban'),
			reason: z.string().trim().min(1).max(1000),
		}),
		z.strictObject({ ...revision, action: z.literal('unban') }),
		z.strictObject({ ...revision, action: z.literal('revoke-sessions') }),
	]),
})
