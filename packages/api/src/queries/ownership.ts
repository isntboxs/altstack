import { ORPCError } from '@orpc/server'
import { and, eq, ne, or, sql } from 'drizzle-orm'

import { activeAccount } from '@altstack/api/queries/account-access'

import { roles } from '@altstack/auth/server/permissions'

import type { db } from '@altstack/db'
import {
	project,
	projectClaim,
	projectMember,
	user,
} from '@altstack/db/schemas'

export const projectIsVerified = sql<boolean>`exists (select 1 from ${projectMember} inner join ${user} on ${user.id} = ${projectMember.userId} where ${projectMember.projectId} = ${project.id} and ${activeAccount})`

export function memberOfProject(userId: string) {
	return sql`exists (select 1 from ${projectMember} inner join ${user} on ${user.id} = ${projectMember.userId} where ${projectMember.projectId} = ${project.id} and ${projectMember.userId} = ${userId} and ${activeAccount})`
}

// Shared by the actual inbox and dashboard so badges count only claims this
// reviewer can act on. Verified projects keep their existing member reviewers.
export function reviewableClaims(userId: string, isAdmin: boolean) {
	return and(
		eq(project.status, 'published'),
		eq(projectClaim.status, 'pending'),
		sql`exists (select 1 from ${user} where ${user.id} = ${projectClaim.userId} and ${activeAccount})`,
		ne(projectClaim.userId, userId),
		or(
			memberOfProject(userId),
			isAdmin ? sql`not (${projectIsVerified})` : undefined
		)
	)
}

export async function requireProjectMember(
	database: Pick<typeof db, 'select'>,
	projectId: string,
	userId: string
) {
	const [member] = await database
		.select({ role: projectMember.role })
		.from(projectMember)
		.innerJoin(project, eq(project.id, projectMember.projectId))
		.innerJoin(user, eq(user.id, projectMember.userId))
		.where(
			and(
				activeAccount,
				eq(projectMember.projectId, projectId),
				eq(projectMember.userId, userId),
				eq(project.status, 'published')
			)
		)
		.limit(1)
	if (
		!member ||
		!roles[member.role].authorize({ project: ['update'] }).success
	) {
		throw new ORPCError('NOT_FOUND')
	}
	return member
}
