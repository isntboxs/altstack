import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ORPCError } from '@orpc/server'
import {
	and,
	asc,
	count,
	desc,
	eq,
	getTableColumns,
	ne,
	or,
	sql,
} from 'drizzle-orm'
import { randomInt, randomUUID } from 'node:crypto'

import {
	checkClaimGithub,
	requireClaimGithub,
	lockClaimGithubAccount,
} from '@altstack/api/claim-github'
import {
	CLAIM_CODE_LIFETIME_MS,
	CLAIM_RESEND_MS,
	claimClientIp,
	claimCodeHash,
	enforceClaimQuota,
	matchesClaimCode,
} from '@altstack/api/ownership-otp'
import { protectedProcedure } from '@altstack/api/procedures'
import { listAdminCategories } from '@altstack/api/queries/category'
import {
	lockCategoryIntegrity,
	validateLeafCategoryAssignments,
} from '@altstack/api/queries/category-integrity'
import {
	memberOfProject,
	projectIsVerified,
	requireProjectMember,
} from '@altstack/api/queries/ownership'
import { s3, S3_BUCKET } from '@altstack/api/s3'
import {
	deleteFinalKeysBestEffort,
	InvalidTempUploadError,
	promoteTempImageToProject,
	TempUploadMissingError,
} from '@altstack/api/storage'

import { roles } from '@altstack/auth/server/permissions'
import { sendProjectClaimEmail } from '@altstack/auth/server/project-claim-email'

import {
	auditLog,
	category,
	project,
	projectCategory,
	projectClaim,
	projectMember,
	projectUpload,
	user,
} from '@altstack/db/schemas'

import { env } from '@altstack/env/server'

import { publishProjectSchema } from '@altstack/shared/schemas/admin-project'
import { categoryNodeSchema } from '@altstack/shared/schemas/category'
import { managedProjectSchema } from '@altstack/shared/schemas/ownership'

const procedure = protectedProcedure.use(async ({ context, next, errors }) => {
	const origin = context.requestHeaders?.get('origin')
	if (
		(origin && !env.CORS_ORIGINS.includes(origin)) ||
		context.requestHeaders?.get('sec-fetch-site') === 'cross-site'
	) {
		throw errors.FORBIDDEN()
	}
	return next()
})
const pageInfo = (page: number, limit: number, totalItems: number) => {
	const totalPages = Math.ceil(totalItems / limit)
	return {
		page,
		limit,
		totalItems,
		totalPages,
		hasNextPage: page < totalPages,
		hasPreviousPage: page > 1,
	}
}
const challenge = (row: {
	challengeId: string
	codeExpiresAt: Date
	requestedAt: Date
}) => {
	return {
		challengeId: row.challengeId,
		expiresAt: row.codeExpiresAt,
		resendAt: new Date(row.requestedAt.getTime() + CLAIM_RESEND_MS),
	}
}
const invalidCode = () =>
	new ORPCError('BAD_REQUEST', {
		message:
			'The code is invalid or expired. Request a new code and try again.',
	})

export const ownershipRouter = {
	github: procedure.ownership.github.handler(
		async ({ context: { db, auth, requestHeaders }, input: { params } }) => {
			await enforceClaimQuota(db, `github-account:${auth.user.id}`, 20)
			await enforceClaimQuota(
				db,
				`github-ip:${claimClientIp(requestHeaders)}`,
				40
			)
			return (await checkClaimGithub(db, auth.user.id, params.id)).evidence
		}
	),
	request: procedure.ownership.request.handler(
		async ({
			context: { db, auth, requestHeaders },
			input: { params, body },
			errors,
		}) => {
			await enforceClaimQuota(db, `send-account:${auth.user.id}`, 5)
			await enforceClaimQuota(db, `send-ip:${claimClientIp(requestHeaders)}`, 5)
			await enforceClaimQuota(db, `send-recipient:${body.email}`, 5)
			const github = await checkClaimGithub(db, auth.user.id, params.id)
			requireClaimGithub(github.evidence)
			const code = String(randomInt(0, 1000000)).padStart(6, '0')
			const now = new Date()
			const binding = {
				challengeId: randomUUID(),
				projectId: params.id,
				userId: auth.user.id,
				...body,
				githubEvidence: github.evidence,
			}
			const prepared = await db.transaction(async (tx) => {
				const [target] = await tx
					.select({
						id: project.id,
						name: project.name,
						repositoryUrl: project.repositoryUrl,
					})
					.from(project)
					.where(
						and(eq(project.id, params.id), eq(project.status, 'published'))
					)
					.for('update')
				if (!target) throw errors.NOT_FOUND()
				await lockClaimGithubAccount(
					tx,
					auth.user.id,
					github,
					target.repositoryUrl
				)
				const [member] = await tx
					.select()
					.from(projectMember)
					.where(
						and(
							eq(projectMember.projectId, params.id),
							eq(projectMember.userId, auth.user.id)
						)
					)
				if (member) {
					throw errors.CONFLICT({ message: 'You already manage this project.' })
				}
				const [previous] = await tx
					.select()
					.from(projectClaim)
					.where(
						and(
							eq(projectClaim.projectId, params.id),
							eq(projectClaim.userId, auth.user.id)
						)
					)
				if (previous?.status === 'pending') {
					throw errors.CONFLICT({
						message:
							'Your email is confirmed. Your request is awaiting approval.',
					})
				}
				if (
					previous &&
					now.getTime() - previous.requestedAt.getTime() < CLAIM_RESEND_MS
				) {
					throw errors.TOO_MANY_REQUESTS({
						message: 'Wait at least 60 seconds before requesting another code.',
					})
				}
				const values = {
					...binding,
					status: 'email_pending' as const,
					codeHash: claimCodeHash(binding, code),
					codeExpiresAt: new Date(now.getTime() + CLAIM_CODE_LIFETIME_MS),
					attempts: 0,
					sentAt: null,
					requestedAt: now,
					emailVerifiedAt: null,
					reviewerId: null,
					reviewedAt: null,
				}
				const [row] = await tx
					.insert(projectClaim)
					.values(values)
					.onConflictDoUpdate({
						target: [projectClaim.projectId, projectClaim.userId],
						set: values,
					})
					.returning()
				if (!row) throw errors.INTERNAL_SERVER_ERROR()
				return { row, projectName: target.name }
			})
			try {
				await sendProjectClaimEmail({
					...body,
					code,
					projectName: prepared.projectName,
				})
				await db
					.update(projectClaim)
					.set({ sentAt: new Date() })
					.where(eq(projectClaim.challengeId, binding.challengeId))
			} catch {
				await db
					.update(projectClaim)
					.set({ codeHash: null })
					.where(eq(projectClaim.challengeId, binding.challengeId))
				throw errors.SERVICE_UNAVAILABLE({
					message:
						'Unable to send a verification code. Please try again later.',
				})
			}
			return challenge(prepared.row)
		}
	),
	verify: procedure.ownership.verify.handler(
		async ({
			context: { db, auth, requestHeaders },
			input: { params, body },
		}) => {
			await enforceClaimQuota(db, `verify-account:${auth.user.id}`, 20)
			await enforceClaimQuota(
				db,
				`verify-ip:${claimClientIp(requestHeaders)}`,
				20
			)
			const valid = await db.transaction(async (tx) => {
				const [target] = await tx
					.select({ id: project.id })
					.from(project)
					.where(
						and(eq(project.id, params.id), eq(project.status, 'published'))
					)
					.for('update')
				if (!target) return false
				const [claim] = await tx
					.select()
					.from(projectClaim)
					.where(
						and(
							eq(projectClaim.projectId, params.id),
							eq(projectClaim.userId, auth.user.id)
						)
					)
					.for('update')
				if (
					!claim ||
					claim.challengeId !== body.challengeId ||
					claim.status !== 'email_pending' ||
					!claim.sentAt ||
					!claim.codeHash ||
					claim.attempts >= 5 ||
					claim.codeExpiresAt.getTime() <= Date.now()
				) {
					return false
				}
				if (
					!matchesClaimCode(claim.codeHash, claimCodeHash(claim, body.code))
				) {
					// Return instead of throwing: failed attempts must commit.
					await tx
						.update(projectClaim)
						.set({
							attempts: claim.attempts + 1,
							...(claim.attempts === 4 ? { codeHash: null } : {}),
						})
						.where(eq(projectClaim.id, claim.id))
					return false
				}
				await tx
					.update(projectClaim)
					.set({
						status: 'pending',
						codeHash: null,
						emailVerifiedAt: new Date(),
					})
					.where(eq(projectClaim.id, claim.id))
				await tx.insert(auditLog).values({
					actorId: auth.user.id,
					projectId: params.id,
					action: 'project_claim_requested',
					metadata: { claimId: claim.id, role: claim.role },
				})
				return true
			})
			if (!valid) throw invalidCode()
			return { success: true as const }
		}
	),
	state: procedure.ownership.state.handler(
		async ({ context: { db, auth }, input: { params }, errors }) => {
			const [target] = await db
				.select({ id: project.id })
				.from(project)
				.where(and(eq(project.id, params.id), eq(project.status, 'published')))
			if (!target) throw errors.NOT_FOUND()
			const [member] = await db
				.select()
				.from(projectMember)
				.where(
					and(
						eq(projectMember.projectId, params.id),
						eq(projectMember.userId, auth.user.id)
					)
				)
			const [claim] = await db
				.select()
				.from(projectClaim)
				.where(
					and(
						eq(projectClaim.projectId, params.id),
						eq(projectClaim.userId, auth.user.id)
					)
				)
			return {
				membership: member?.role ?? null,
				claim: claim
					? {
							status: claim.status,
							email: claim.email,
							role: claim.role,
							challenge:
								claim.status === 'email_pending' &&
								claim.sentAt &&
								claim.codeHash
									? challenge(claim)
									: null,
							githubEvidence: claim.githubEvidence,
						}
					: null,
			}
		}
	),
	list: procedure.ownership.list.handler(
		async ({
			context: { db, auth },
			input: {
				query: { page, limit },
			},
		}) => {
			const where = and(
				memberOfProject(auth.user.id),
				eq(project.status, 'published')
			)
			return db.transaction(
				async (tx) => {
					const projects = await tx
						.select({
							id: project.id,
							name: project.name,
							slug: project.slug,
							role: projectMember.role,
						})
						.from(project)
						.innerJoin(
							projectMember,
							and(
								eq(projectMember.projectId, project.id),
								eq(projectMember.userId, auth.user.id)
							)
						)
						.where(where)
						.orderBy(asc(project.name), asc(project.id))
						.limit(limit)
						.offset((page - 1) * limit)
					const [total] = await tx
						.select({ count: count() })
						.from(project)
						.where(where)
					return {
						projects,
						pagination: pageInfo(page, limit, total?.count ?? 0),
					}
				},
				{ isolationLevel: 'repeatable read', accessMode: 'read only' }
			)
		}
	),
	inbox: procedure.ownership.inbox.handler(
		async ({
			context: { db, auth },
			input: {
				query: { page, limit },
			},
		}) => {
			const where = and(
				eq(project.status, 'published'),
				eq(projectClaim.status, 'pending'),
				ne(projectClaim.userId, auth.user.id),
				or(
					memberOfProject(auth.user.id),
					auth.user.role === 'admin'
						? sql`not (${projectIsVerified})`
						: undefined
				)
			)
			return db.transaction(
				async (tx) => {
					const claims = await tx
						.select({
							id: projectClaim.id,
							projectId: project.id,
							projectName: project.name,
							projectSlug: project.slug,
							name: user.name,
							email: projectClaim.email,
							role: projectClaim.role,
							requestedAt: projectClaim.requestedAt,
							githubEvidence: projectClaim.githubEvidence,
						})
						.from(projectClaim)
						.innerJoin(project, eq(project.id, projectClaim.projectId))
						.innerJoin(user, eq(user.id, projectClaim.userId))
						.where(where)
						.orderBy(desc(projectClaim.requestedAt), desc(projectClaim.id))
						.limit(limit)
						.offset((page - 1) * limit)
					const [total] = await tx
						.select({ count: count() })
						.from(projectClaim)
						.innerJoin(project, eq(project.id, projectClaim.projectId))
						.where(where)
					return {
						claims,
						pagination: pageInfo(page, limit, total?.count ?? 0),
					}
				},
				{ isolationLevel: 'repeatable read', accessMode: 'read only' }
			)
		}
	),
	review: procedure.ownership.review.handler(
		async ({ context: { db, auth }, input: { params, body }, errors }) => {
			const [target] = await db
				.select({
					projectId: projectClaim.projectId,
					userId: projectClaim.userId,
					challengeId: projectClaim.challengeId,
				})
				.from(projectClaim)
				.where(eq(projectClaim.id, params.id))
			if (!target) throw errors.NOT_FOUND()
			if (target.userId === auth.user.id) throw errors.FORBIDDEN()
			const [reviewable] = await db
				.select({ id: project.id })
				.from(project)
				.where(
					and(
						eq(project.id, target.projectId),
						eq(project.status, 'published'),
						or(
							memberOfProject(auth.user.id),
							auth.user.role === 'admin'
								? sql`not (${projectIsVerified})`
								: undefined
						)
					)
				)
			if (!reviewable) throw errors.NOT_FOUND()
			const github =
				body.decision === 'approve'
					? await (async () => {
							await enforceClaimQuota(db, `review-github:${auth.user.id}`, 30)
							const result = await checkClaimGithub(
								db,
								target.userId,
								target.projectId
							)
							requireClaimGithub(result.evidence)
							if (
								result.evidence.status !== 'verified' &&
								!body.manualEvidence
							) {
								throw errors.BAD_REQUEST({
									message:
										'GitHub cannot confirm maintainer access. Record at least 20 characters of independent verification evidence before approving.',
								})
							}
							return result
						})()
					: null
			return db.transaction(async (tx) => {
				const [visible] = await tx
					.select({ id: project.id, repositoryUrl: project.repositoryUrl })
					.from(project)
					.where(
						and(
							eq(project.id, target.projectId),
							eq(project.status, 'published')
						)
					)
					.for('update')
				if (!visible) throw errors.NOT_FOUND()
				const members = await tx
					.select()
					.from(projectMember)
					.where(eq(projectMember.projectId, visible.id))
				const member = members.find((item) => item.userId === auth.user.id)
				if (
					!(
						member &&
						roles[member.role].authorize({ project: ['review-claim'] }).success
					) &&
					!(members.length === 0 && auth.user.role === 'admin')
				) {
					throw errors.NOT_FOUND()
				}
				const [claim] = await tx
					.select()
					.from(projectClaim)
					.where(eq(projectClaim.id, params.id))
					.for('update')
				if (!claim || claim.userId === auth.user.id) throw errors.FORBIDDEN()
				if (
					claim.status !== 'pending' ||
					!claim.emailVerifiedAt ||
					claim.challengeId !== target.challengeId
				) {
					throw errors.CONFLICT({
						message: 'This request has already changed. Refresh the inbox.',
					})
				}
				if (body.decision === 'approve') {
					if (!github) throw errors.INTERNAL_SERVER_ERROR()
					await lockClaimGithubAccount(
						tx,
						claim.userId,
						github,
						visible.repositoryUrl
					)
					await tx.insert(projectMember).values({
						projectId: visible.id,
						userId: claim.userId,
						role: claim.role,
						approvedBy: auth.user.id,
					})
					// A claim never replaces an admin role. Global labels do not authorize
					// project access; the per-project Better Auth role does.
					await tx
						.update(user)
						.set({
							role: sql`case when ${user.role} in ('admin', 'owner') then ${user.role} else ${claim.role} end`,
						})
						.where(eq(user.id, claim.userId))
				}
				await tx
					.update(projectClaim)
					.set({
						status: body.decision === 'approve' ? 'approved' : 'rejected',
						...(github ? { githubEvidence: github.evidence } : {}),
						reviewerId: auth.user.id,
						reviewedAt: new Date(),
					})
					.where(eq(projectClaim.id, claim.id))
				await tx.insert(auditLog).values({
					actorId: auth.user.id,
					projectId: visible.id,
					action:
						body.decision === 'approve'
							? 'project_claim_approved'
							: 'project_claim_rejected',
					metadata: {
						claimId: claim.id,
						role: claim.role,
						...(github
							? {
									github: github.evidence,
									...(body.manualEvidence
										? { manualEvidence: body.manualEvidence }
										: {}),
								}
							: {}),
					},
				})
				return { success: true as const }
			})
		}
	),
	get: procedure.ownership.get.handler(
		async ({ context: { db, auth }, input: { params }, errors }) =>
			db.transaction(
				async (tx) => {
					await requireProjectMember(tx, params.id, auth.user.id)
					const [row] = await tx
						.select({
							...getTableColumns(project),
							revision: sql<string>`xmin::text`,
							verified: projectIsVerified,
						})
						.from(project)
						.where(
							and(eq(project.id, params.id), eq(project.status, 'published'))
						)
					if (!row) throw errors.NOT_FOUND()
					const categories = await tx
						.select({ slug: category.slug })
						.from(projectCategory)
						.innerJoin(category, eq(category.id, projectCategory.categoryId))
						.where(eq(projectCategory.projectId, params.id))
					return managedProjectSchema.parse({
						...row,
						categorySlugs: categories.map((item) => item.slug),
					})
				},
				{ isolationLevel: 'repeatable read', accessMode: 'read only' }
			)
	),
	categories: procedure.ownership.categories.handler(
		async ({ context: { db, auth }, input: { params } }) => {
			await requireProjectMember(db, params.id, auth.user.id)
			return {
				categories: (await listAdminCategories(db)).map((node) =>
					categoryNodeSchema.parse(node)
				),
			}
		}
	),
	update: procedure.ownership.update.handler(
		async ({ context: { db, auth }, input: { params, body }, errors }) => {
			const promoted: Array<string> = [],
				stale: Array<string> = []
			const promotion = { consumed: false }
			try {
				await db.transaction(async (tx) => {
					await lockCategoryIntegrity(tx)
					const [current] = await tx
						.select({
							...getTableColumns(project),
							revision: sql<string>`xmin::text`,
						})
						.from(project)
						.where(
							and(eq(project.id, params.id), eq(project.status, 'published'))
						)
						.for('update')
					if (!current) throw errors.NOT_FOUND()
					await requireProjectMember(tx, params.id, auth.user.id)
					if (current.revision !== body.revision) {
						throw errors.CONFLICT({
							message: 'This project changed. Reload it before saving.',
						})
					}
					const assignments = await tx
						.select({ slug: category.slug })
						.from(projectCategory)
						.innerJoin(category, eq(category.id, projectCategory.categoryId))
						.where(eq(projectCategory.projectId, params.id))
					const categorySlugs =
						body.categorySlugs ?? assignments.map((item) => item.slug)
					const {
						revision: _revision,
						logo: logoInput,
						screenshot: screenshotInput,
						categorySlugs: _categories,
						...copy
					} = body
					void _revision
					void _categories
					const merged = {
						...current,
						...copy,
						logo: logoInput === undefined ? current.logo : logoInput,
						categorySlugs,
					}
					const publishable = publishProjectSchema.safeParse(merged)
					if (!publishable.success) {
						throw errors.BAD_REQUEST({
							message: publishable.error.issues
								.map((issue) => issue.message)
								.join('; '),
						})
					}
					const categoryIds = await validateLeafCategoryAssignments(
						tx,
						categorySlugs
					)
					let logo = current.logo,
						screenshot = current.screenshot
					for (const [kind, key] of [
						['logo', logoInput],
						['screenshot', screenshotInput],
					] as const) {
						if (key === undefined) continue
						if (key !== null) {
							const [upload] = await tx
								.select()
								.from(projectUpload)
								.where(
									and(
										eq(projectUpload.key, key),
										eq(projectUpload.projectId, params.id),
										eq(projectUpload.userId, auth.user.id)
									)
								)
								.for('update')
							if (!upload) {
								throw errors.BAD_REQUEST({
									message: 'Upload this image again from this project editor.',
								})
							}
							const final = await promoteTempImageToProject({
								tmpKey: key,
								slug: current.slug,
								kind,
							})
							promotion.consumed = true
							promoted.push(final)
							await tx.delete(projectUpload).where(eq(projectUpload.key, key))
							if (kind === 'logo') logo = final
							else screenshot = final
						} else if (kind === 'screenshot') screenshot = null
						if (current[kind]) stale.push(current[kind])
					}
					await tx
						.update(project)
						.set({ ...copy, logo, screenshot })
						.where(eq(project.id, params.id))
					if (body.categorySlugs !== undefined) {
						await tx
							.delete(projectCategory)
							.where(eq(projectCategory.projectId, params.id))
						await tx.insert(projectCategory).values(
							categoryIds.map((categoryId) => {
								return {
									projectId: params.id,
									categoryId,
								}
							})
						)
					}
					await tx.insert(auditLog).values({
						actorId: auth.user.id,
						projectId: params.id,
						action: 'project_member_updated',
					})
				})
			} catch (error) {
				await deleteFinalKeysBestEffort(promoted)
				if (promotion.consumed) throw errors.UPLOAD_CONSUMED()
				if (
					error instanceof TempUploadMissingError ||
					error instanceof InvalidTempUploadError
				) {
					throw errors.UPLOAD_EXPIRED()
				}
				if (error instanceof ORPCError) throw error
				throw errors.INTERNAL_SERVER_ERROR()
			}
			await deleteFinalKeysBestEffort(stale)
			return { success: true as const }
		}
	),
	upload: procedure.ownership.upload.handler(
		async ({ context: { db, auth }, input: { params, body }, errors }) => {
			await enforceClaimQuota(db, `upload:${auth.user.id}`, 40)
			return db.transaction(async (tx) => {
				const [visible] = await tx
					.select({ id: project.id })
					.from(project)
					.where(
						and(eq(project.id, params.id), eq(project.status, 'published'))
					)
					.for('share')
				if (!visible) throw errors.NOT_FOUND()
				await requireProjectMember(tx, params.id, auth.user.id)
				const ext = {
					'image/png': 'png',
					'image/jpeg': 'jpg',
					'image/webp': 'webp',
					'image/gif': 'gif',
				}[body.contentType]
				const key = `tmp/${body.kind === 'logo' ? 'logos' : 'screenshots'}/claim-${randomUUID()}-${Date.now()}.${ext}`
				await tx
					.insert(projectUpload)
					.values({ key, projectId: params.id, userId: auth.user.id })
				const presignedUrl = await getSignedUrl(
					s3,
					new PutObjectCommand({
						Bucket: S3_BUCKET,
						Key: key,
						ContentType: body.contentType,
						ContentLength: body.size,
					}),
					{ expiresIn: 600 }
				)
				return { key, presignedUrl }
			})
		}
	),
	removeUpload: procedure.ownership.removeUpload.handler(
		async ({ context: { db, auth }, input: { params, body }, errors }) =>
			db.transaction(async (tx) => {
				const [visible] = await tx
					.select({ id: project.id })
					.from(project)
					.where(
						and(eq(project.id, params.id), eq(project.status, 'published'))
					)
					.for('share')
				if (!visible) throw errors.NOT_FOUND()
				await requireProjectMember(tx, params.id, auth.user.id)
				const [upload] = await tx
					.select()
					.from(projectUpload)
					.where(
						and(
							eq(projectUpload.key, body.key),
							eq(projectUpload.projectId, params.id),
							eq(projectUpload.userId, auth.user.id)
						)
					)
					.for('update')
				if (!upload) throw errors.NOT_FOUND()
				try {
					await s3.send(
						new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: body.key })
					)
				} catch {
					throw errors.INTERNAL_SERVER_ERROR()
				}
				await tx.delete(projectUpload).where(eq(projectUpload.key, body.key))
				return { success: true as const }
			})
	),
}
