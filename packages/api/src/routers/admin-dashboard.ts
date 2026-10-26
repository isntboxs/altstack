import { and, asc, count, desc, eq, gte, isNotNull, lt, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { z } from 'zod'

import { adminProcedure } from '@altstack/api/procedures'
import { reviewableClaims } from '@altstack/api/queries/ownership'

import {
	auditLog,
	githubRepository,
	project,
	projectClaim,
	projectReport,
	reviewNotification,
	user,
} from '@altstack/db/schemas'

import { PROJECT_STATUS } from '@altstack/shared/constants'

const needsReview = and(
	eq(project.status, 'draft'),
	isNotNull(project.submitterId)
)
const status = z.enum(PROJECT_STATUS).nullable().catch(null)
const role = z
	.enum(['user', 'admin', 'owner', 'maintainer'])
	.nullable()
	.catch(null)
const targetUser = alias(user, 'target_user')

export const adminDashboardRouter = {
	overview: adminProcedure.admin.dashboard.overview.handler(
		async ({ context: { db, auth } }) =>
			db.transaction(
				async (tx) => {
					const statuses = await tx
						.select({ status: project.status, count: count() })
						.from(project)
						.groupBy(project.status)
					const [reviewCount] = await tx
						.select({ count: count() })
						.from(project)
						.where(needsReview)
					const [reportCount] = await tx
						.select({ count: count() })
						.from(projectReport)
						.where(eq(projectReport.status, 'open'))
					const claimsWhere = reviewableClaims(auth.user.id, true)
					const [claimCount] = await tx
						.select({ count: count() })
						.from(projectClaim)
						.innerJoin(project, eq(project.id, projectClaim.projectId))
						.where(claimsWhere)
					const [userCount] = await tx.select({ count: count() }).from(user)
					const submissions = await tx
						.select({
							id: project.id,
							name: project.name,
							createdAt: project.createdAt,
							submitter: { id: user.id, name: user.name },
						})
						.from(project)
						.leftJoin(user, eq(project.submitterId, user.id))
						.where(needsReview)
						.orderBy(asc(project.createdAt), asc(project.id))
						.limit(5)
					const reports = await tx
						.select({
							id: projectReport.id,
							type: projectReport.type,
							createdAt: projectReport.createdAt,
							project: { id: project.id, name: project.name },
						})
						.from(projectReport)
						.leftJoin(project, eq(project.id, projectReport.projectId))
						.where(eq(projectReport.status, 'open'))
						.orderBy(asc(projectReport.createdAt), asc(projectReport.id))
						.limit(5)
					const claims = await tx
						.select({
							id: projectClaim.id,
							projectId: project.id,
							projectName: project.name,
							name: user.name,
							role: projectClaim.role,
							requestedAt: projectClaim.requestedAt,
						})
						.from(projectClaim)
						.innerJoin(project, eq(project.id, projectClaim.projectId))
						.innerJoin(user, eq(user.id, projectClaim.userId))
						.where(claimsWhere)
						.orderBy(asc(projectClaim.requestedAt), asc(projectClaim.id))
						.limit(5)
					return {
						observedAt: new Date(),
						counts: {
							published:
								statuses.find((item) => item.status === 'published')?.count ??
								0,
							needsReview: reviewCount?.count ?? 0,
							openReports: reportCount?.count ?? 0,
							pendingClaims: claimCount?.count ?? 0,
							totalProjects: statuses.reduce(
								(sum, item) => sum + item.count,
								0
							),
							users: userCount?.count ?? 0,
						},
						statuses: PROJECT_STATUS.map((value) => {
							return {
								status: value,
								count:
									statuses.find((item) => item.status === value)?.count ?? 0,
							}
						}),
						submissions,
						reports,
						claims,
					}
				},
				{ isolationLevel: 'repeatable read', accessMode: 'read only' }
			)
	),
	activity: adminProcedure.admin.dashboard.activity.handler(
		async ({ context: { db }, input: { query } }) => {
			const where = and(
				query.action ? eq(auditLog.action, query.action) : undefined,
				query.actorId ? eq(auditLog.actorId, query.actorId) : undefined,
				query.projectId ? eq(auditLog.projectId, query.projectId) : undefined,
				query.from
					? gte(auditLog.createdAt, new Date(`${query.from}T00:00:00Z`))
					: undefined,
				query.to
					? lt(
							auditLog.createdAt,
							new Date(new Date(`${query.to}T00:00:00Z`).getTime() + 86_400_000)
						)
					: undefined
			)
			return db.transaction(
				async (tx) => {
					const rows = await tx
						.select({
							id: auditLog.id,
							action: auditLog.action,
							createdAt: auditLog.createdAt,
							actor: { id: user.id, name: user.name },
							project: { id: project.id, name: project.name },
							targetUser: { id: targetUser.id, name: targetUser.name },
							fromStatus: sql<unknown>`${auditLog.metadata}->>'fromStatus'`,
							toStatus: sql<unknown>`${auditLog.metadata}->>'toStatus'`,
							role: sql<unknown>`${auditLog.metadata}->>'role'`,
							previousRole: sql<unknown>`${auditLog.metadata}->>'previousRole'`,
						})
						.from(auditLog)
						.leftJoin(user, eq(user.id, auditLog.actorId))
						.leftJoin(project, eq(project.id, auditLog.projectId))
						.leftJoin(
							targetUser,
							sql`${targetUser.id}::text = ${auditLog.metadata}->>'userId'`
						)
						.where(where)
						.orderBy(desc(auditLog.createdAt), desc(auditLog.id))
						.limit(query.limit)
						.offset((query.page - 1) * query.limit)
					const [total] = await tx
						.select({ count: count() })
						.from(auditLog)
						.where(where)
					return {
						events: rows.map(
							({
								fromStatus,
								toStatus,
								role: nextRole,
								previousRole,
								...event
							}) => {
								return {
									...event,
									details: {
										fromStatus: status.parse(fromStatus),
										toStatus: status.parse(toStatus),
										role: role.parse(nextRole),
										previousRole: role.parse(previousRole),
									},
								}
							}
						),
						page: query.page,
						totalItems: total?.count ?? 0,
						totalPages: Math.ceil((total?.count ?? 0) / query.limit),
					}
				},
				{ isolationLevel: 'repeatable read', accessMode: 'read only' }
			)
		}
	),
	operations: adminProcedure.admin.dashboard.operations.handler(
		async ({ context: { db } }) =>
			db.transaction(
				async (tx) => {
					const observedAt = new Date()
					const cutoff = new Date(observedAt.getTime() - 48 * 60 * 60 * 1000)
					const [github] = await tx
						.select({
							total: count(),
							fresh:
								sql<number>`count(*) filter (where ${githubRepository.fetchedAt} >= ${cutoff})`.mapWith(
									Number
								),
							stale:
								sql<number>`count(*) filter (where ${githubRepository.fetchedAt} < ${cutoff})`.mapWith(
									Number
								),
							missing:
								sql<number>`count(*) filter (where ${githubRepository.projectId} is null)`.mapWith(
									Number
								),
							latestFetchedAt:
								sql<Date | null>`max(${githubRepository.fetchedAt})`.mapWith(
									githubRepository.fetchedAt
								),
							oldestFetchedAt:
								sql<Date | null>`min(${githubRepository.fetchedAt})`.mapWith(
									githubRepository.fetchedAt
								),
						})
						.from(project)
						.leftJoin(
							githubRepository,
							eq(project.id, githubRepository.projectId)
						)
						.where(eq(project.status, 'published'))
					const outboxCounts = await tx
						.select({ status: reviewNotification.status, count: count() })
						.from(reviewNotification)
						.groupBy(reviewNotification.status)
					const [timing] = await tx
						.select({
							due: sql<number>`count(*) filter (where ${reviewNotification.status} = 'pending' and ${reviewNotification.nextAttemptAt} <= ${observedAt})`.mapWith(
								Number
							),
							oldestPendingAt:
								sql<Date | null>`min(${reviewNotification.createdAt}) filter (where ${reviewNotification.status} = 'pending')`.mapWith(
									reviewNotification.createdAt
								),
							lastSentAt:
								sql<Date | null>`max(${reviewNotification.sentAt})`.mapWith(
									reviewNotification.sentAt
								),
						})
						.from(reviewNotification)
					const outboxCount = (
						value: (typeof reviewNotification.$inferSelect)['status']
					) => outboxCounts.find((item) => item.status === value)?.count ?? 0
					return {
						observedAt,
						github: {
							...github!,
							staleAfterHours: 48 as const,
							failureTelemetry: 'unavailable' as const,
						},
						outbox: {
							...timing!,
							pending: outboxCount('pending'),
							failed: outboxCount('failed'),
							sent: outboxCount('sent'),
							cancelled: outboxCount('cancelled'),
						},
					}
				},
				{ isolationLevel: 'repeatable read', accessMode: 'read only' }
			)
	),
}
