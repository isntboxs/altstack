import { ORPCError } from '@orpc/server'
import { and, eq, sql } from 'drizzle-orm'

import { roles } from '@altstack/auth/server/permissions'

import type { db } from '@altstack/db'
import { project, projectMember } from '@altstack/db/schemas'

export const projectIsVerified = sql<boolean>`exists (select 1 from ${projectMember} where ${projectMember.projectId} = ${project.id})`

export function memberOfProject(userId: string) {
	return sql`exists (select 1 from ${projectMember} where ${projectMember.projectId} = ${project.id} and ${projectMember.userId} = ${userId})`
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
		.where(
			and(
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
