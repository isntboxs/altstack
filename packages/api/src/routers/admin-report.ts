import { and, desc, eq, sql } from 'drizzle-orm'

import { adminProcedure } from '@altstack/api/procedures'

import { project, projectReport } from '@altstack/db/schemas'

export const adminReportRouter = {
	list: adminProcedure.admin.report.list.handler(
		async ({ context: { db }, input, errors }) => {
			const { status, cursor, limit } = input.query
			if (cursor) {
				const [anchor] = await db
					.select({ id: projectReport.id })
					.from(projectReport)
					.where(eq(projectReport.id, cursor))
					.limit(1)
				if (!anchor) {
					throw errors.BAD_REQUEST({
						message: 'Report page expired. Return to the first page.',
					})
				}
			}
			const rows = await db
				.select({
					id: projectReport.id,
					email: projectReport.email,
					type: projectReport.type,
					message: projectReport.message,
					createdAt: projectReport.createdAt,
					status: projectReport.status,
					project: {
						id: project.id,
						name: project.name,
						logo: project.logo,
						status: project.status,
					},
				})
				.from(projectReport)
				.leftJoin(project, eq(project.id, projectReport.projectId))
				.where(
					and(
						status === 'all' ? undefined : eq(projectReport.status, status),
						cursor
							? sql`(${projectReport.createdAt}, ${projectReport.id}) < (
					SELECT created_at, id FROM ${projectReport} WHERE id = ${cursor}
				)`
							: undefined
					)
				)
				.orderBy(desc(projectReport.createdAt), desc(projectReport.id))
				.limit(limit + 1)
			const reports = rows.slice(0, limit)
			return {
				reports,
				nextCursor: rows.length > limit ? reports.at(-1)!.id : null,
			}
		}
	),
	moderate: adminProcedure.admin.report.moderate.handler(
		async ({ context: { db }, input, errors }) => {
			// A single compare-and-set prevents concurrent admins overwriting a decision.
			const [updated] = await db
				.update(projectReport)
				.set({ status: input.body.status })
				.where(
					and(
						eq(projectReport.id, input.params.id),
						eq(projectReport.status, 'open')
					)
				)
				.returning({ id: projectReport.id, status: projectReport.status })
			if (updated) return { id: updated.id, status: input.body.status }
			const [existing] = await db
				.select({ id: projectReport.id })
				.from(projectReport)
				.where(eq(projectReport.id, input.params.id))
				.limit(1)
			if (!existing) throw errors.NOT_FOUND()
			throw errors.CONFLICT({
				message: 'This report has already been reviewed. Refresh the inbox.',
			})
		}
	),
}
