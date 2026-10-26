import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	ilike,
	inArray,
	not,
	or,
	sql,
} from 'drizzle-orm'

import { adminProcedure } from '@altstack/api/procedures'
import {
	activeAccount,
	requireActiveAccount,
} from '@altstack/api/queries/account-access'

import { APIError, createAuth } from '@altstack/auth/server'

import {
	account,
	auditLog,
	project,
	projectMember,
	session,
	user,
} from '@altstack/db/schemas'

import { env } from '@altstack/env/server'

const userRevision = sql<string>`${user}.xmin::text`
const columns = {
	id: user.id,
	name: user.name,
	email: user.email,
	emailVerified: user.emailVerified,
	role: user.role,
	banned: sql<boolean>`not ${activeAccount}`,
	banReason: user.banReason,
	banExpires: user.banExpires,
	createdAt: user.createdAt,
	revision: userRevision,
}
const procedure = adminProcedure.use(async ({ context, next, errors }) => {
	const origin = context.requestHeaders?.get('origin')
	if (
		(origin && !env.CORS_ORIGINS.includes(origin)) ||
		context.requestHeaders?.get('sec-fetch-site') === 'cross-site'
	) {
		throw errors.FORBIDDEN()
	}
	const actor = await requireActiveAccount(context.db, context.auth.user.id)
	if (actor.role !== 'admin') throw errors.FORBIDDEN()
	return next()
})

export const adminUserRouter = {
	list: procedure.admin.user.list.handler(
		async ({
			context: { db },
			input: {
				query: { q = '', role = 'all', status = 'all', page = 1 },
			},
		}) => {
			const limit = 25
			const escaped = q.replaceAll(/[\\%_]/g, '\\$&')
			const where = and(
				q
					? or(
							ilike(user.name, `%${escaped}%`),
							ilike(user.email, `%${escaped}%`)
						)
					: undefined,
				role === 'all' ? undefined : eq(user.role, role),
				status === 'all'
					? undefined
					: status === 'active'
						? activeAccount
						: not(activeAccount)
			)
			return db.transaction(
				async (tx) => {
					const users = await tx
						.select(columns)
						.from(user)
						.where(where)
						.orderBy(desc(user.createdAt), desc(user.id))
						.limit(limit)
						.offset((page - 1) * limit)
					const [total] = await tx
						.select({ count: count() })
						.from(user)
						.where(where)
					const totalItems = total?.count ?? 0,
						totalPages = Math.ceil(totalItems / limit)
					return {
						users,
						pagination: {
							page,
							limit,
							totalItems,
							totalPages,
							hasNextPage: page < totalPages,
							hasPreviousPage: page > 1,
						},
					}
				},
				{ isolationLevel: 'repeatable read', accessMode: 'read only' }
			)
		}
	),
	get: procedure.admin.user.get.handler(
		async ({ context: { db }, input: { params }, errors }) =>
			db.transaction(
				async (tx) => {
					const [person] = await tx
						.select(columns)
						.from(user)
						.where(eq(user.id, params.id))
					if (!person) throw errors.NOT_FOUND()
					const providers = await tx
						.selectDistinct({ provider: account.providerId })
						.from(account)
						.where(eq(account.userId, params.id))
					const [sessions] = await tx
						.select({ count: count() })
						.from(session)
						.where(
							and(
								eq(session.userId, params.id),
								gt(session.expiresAt, new Date())
							)
						)
					const memberships = await tx
						.select({
							projectId: project.id,
							projectName: project.name,
							status: project.status,
							role: projectMember.role,
						})
						.from(projectMember)
						.innerJoin(project, eq(project.id, projectMember.projectId))
						.where(eq(projectMember.userId, params.id))
						.orderBy(asc(project.name), asc(project.id))
					return {
						user: person,
						providers: providers.map((p) => p.provider),
						activeSessions: sessions?.count ?? 0,
						memberships,
					}
				},
				{ isolationLevel: 'repeatable read', accessMode: 'read only' }
			)
	),
	action: procedure.admin.user.action.handler(
		async ({
			context: { db, auth, requestHeaders },
			input: { params, body },
			errors,
		}) =>
			db.transaction(async (tx) => {
				// One transaction-wide lock serializes admin-count decisions, including
				// reciprocal bans/demotions from sessions created before the first change.
				await tx.execute(sql`select pg_advisory_xact_lock(192874, 2)`)
				await tx
					.select({ id: user.id })
					.from(user)
					.where(inArray(user.id, [auth.user.id, params.id]))
					.orderBy(asc(user.id))
					.for('update')
				const actor = await requireActiveAccount(tx, auth.user.id)
				if (actor.role !== 'admin') throw errors.FORBIDDEN()
				const [target] = await tx
					.select(columns)
					.from(user)
					.where(eq(user.id, params.id))
				if (!target) throw errors.NOT_FOUND()
				if (target.revision !== body.revision) {
					throw errors.CONFLICT({
						message:
							'This account changed. Refresh the user before trying again.',
					})
				}
				if (body.action === 'ban' && params.id === actor.id) {
					throw errors.FORBIDDEN({
						message: 'You cannot ban your own account.',
					})
				}
				if (
					target.role === 'admin' &&
					!target.banned &&
					(body.action === 'ban' ||
						(body.action === 'set-role' && body.role !== 'admin'))
				) {
					const [admins] = await tx
						.select({ count: count() })
						.from(user)
						.where(and(eq(user.role, 'admin'), activeAccount))
					if ((admins?.count ?? 0) <= 1) {
						throw errors.CONFLICT({
							message:
								'Keep at least one active admin. Promote another account first.',
						})
					}
				}
				if (!requestHeaders) throw errors.UNAUTHORIZED()
				// Bind Better Auth's supported server API to the same transaction:
				// role/ban/session updates and audit either all commit or all roll back.
				const api = createAuth(tx).api
				const headers = requestHeaders
				try {
					switch (body.action) {
						case 'set-role':
							await api.setRole({
								headers,
								body: { userId: params.id, role: body.role },
							})
							// Role changes invalidate all old sessions, including self-demotion.
							await tx.delete(session).where(eq(session.userId, params.id))
							break
						case 'ban':
							await api.banUser({
								headers,
								body: { userId: params.id, banReason: body.reason },
							})
							break
						case 'unban':
							await api.unbanUser({ headers, body: { userId: params.id } })
							break
						case 'revoke-sessions':
							await api.revokeUserSessions({
								headers,
								body: { userId: params.id },
							})
							break
					}
				} catch (error) {
					if (error instanceof APIError) {
						if (error.statusCode === 401) throw errors.UNAUTHORIZED()
						if (error.statusCode === 403) throw errors.FORBIDDEN()
					}
					throw error
				}
				// Also advances the revision for session-only actions.
				await tx
					.update(user)
					.set({ updatedAt: new Date() })
					.where(eq(user.id, params.id))
				await tx.insert(auditLog).values({
					actorId: actor.id,
					action:
						body.action === 'set-role'
							? 'user_role_changed'
							: body.action === 'ban'
								? 'user_banned'
								: body.action === 'unban'
									? 'user_unbanned'
									: 'user_sessions_revoked',
					reason: body.action === 'ban' ? body.reason : undefined,
					metadata: {
						userId: params.id,
						...(body.action === 'set-role'
							? { previousRole: target.role, role: body.role }
							: {}),
					},
				})
				return { success: true as const }
			})
	),
}
