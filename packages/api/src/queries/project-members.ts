import { ORPCError } from '@orpc/server'
import { and, eq, sql } from 'drizzle-orm'

import { requireActiveAccount } from '@altstack/api/queries/account-access'

import type { db } from '@altstack/db'
import {
	auditLog,
	project,
	projectClaim,
	projectMember,
	projectUpload,
} from '@altstack/db/schemas'

export const memberRevision = sql<string>`${projectMember}.xmin::text`

export async function changeProjectMembership(
	database: typeof db,
	actorId: string,
	projectId: string,
	targetId: string,
	revision: string,
	action: 'leave' | 'revoke' | 'role',
	role?: 'owner' | 'maintainer'
) {
	return database.transaction(async (tx) => {
		const [target] = await tx
			.select({ id: project.id })
			.from(project)
			.where(eq(project.id, projectId))
			.for('update')
		if (!target) throw new ORPCError('NOT_FOUND')
		const actor = await requireActiveAccount(tx, actorId, true)
		if (action !== 'leave' && actor.role !== 'admin') {
			throw new ORPCError('FORBIDDEN')
		}
		if (action === 'leave' ? actorId !== targetId : actorId === targetId) {
			throw new ORPCError('FORBIDDEN', {
				message:
					'Use Leave project for your own membership. Another admin must change your project role.',
			})
		}
		const where = and(
			eq(projectMember.projectId, projectId),
			eq(projectMember.userId, targetId)
		)
		const [member] = await tx
			.select({ role: projectMember.role, revision: memberRevision })
			.from(projectMember)
			.where(where)
			.for('update')
		if (!member || member.revision !== revision) {
			throw new ORPCError('CONFLICT', {
				message:
					'This membership changed. Refresh members before trying again.',
			})
		}
		if (action === 'role') {
			if (!role) throw new ORPCError('BAD_REQUEST')
			await tx.update(projectMember).set({ role }).where(where)
		} else {
			await tx
				.delete(projectUpload)
				.where(
					and(
						eq(projectUpload.projectId, projectId),
						eq(projectUpload.userId, targetId)
					)
				)
			// Remove old proof too: returning requires a new OTP and independent review.
			await tx
				.delete(projectClaim)
				.where(
					and(
						eq(projectClaim.projectId, projectId),
						eq(projectClaim.userId, targetId)
					)
				)
			await tx.delete(projectMember).where(where)
		}
		await tx.insert(auditLog).values({
			actorId,
			projectId,
			action:
				action === 'role'
					? 'project_member_role_changed'
					: action === 'leave'
						? 'project_member_left'
						: 'project_member_revoked',
			metadata: {
				userId: targetId,
				previousRole: member.role,
				...(action === 'role' ? { role } : {}),
			},
		})
		return { success: true as const }
	})
}
