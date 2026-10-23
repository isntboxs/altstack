import { ratelimit } from '@orpc/ratelimit'
import { ORPCError } from '@orpc/server'
import { and, count, desc, eq, ilike, inArray, ne, sql } from 'drizzle-orm'

import { fetchPublicGithubRepository } from '@altstack/api/github'
import { emptyGithubMetadata } from '@altstack/api/github-refresh'
import { protectedProcedure } from '@altstack/api/procedures'
import { isUniqueViolation } from '@altstack/api/queries/pg-error'
import {
	lockSubmissionCapacity,
	requireSubmissionCapacity,
} from '@altstack/api/submission-capacity'
import { submissionRateLimiter } from '@altstack/api/submission-rate-limit'

import type { db as Database } from '@altstack/db'
import {
	auditLog,
	githubRepository,
	githubStarHistory,
	project,
} from '@altstack/db/schemas'
import { canonicalRepositoryKey } from '@altstack/db/schemas/project'
import { syncProjectTags } from '@altstack/db/tags'

import { canonicalizeGithubUrl } from '@altstack/shared/lib/github'
import { slugify } from '@altstack/shared/lib/slug'

const intakeColumns = {
	id: project.id,
	name: project.name,
	repositoryUrl: project.repositoryUrl,
	websiteUrl: project.websiteUrl,
	status: project.status,
	rejectionReason: project.rejectionReason,
	revision: sql<string>`xmin::text`,
}

function requireRejected(status: string) {
	if (status !== 'rejected') {
		throw new ORPCError('CONFLICT', {
			message: 'Only rejected submissions can be edited and resubmitted.',
		})
	}
}

function requireRevision(actual: string, expected: string) {
	if (actual !== expected) {
		throw new ORPCError('CONFLICT', {
			message:
				'This submission changed. Close the form and reopen it to review the latest feedback.',
		})
	}
}

async function lockRepositoryIdentity(
	database: Pick<typeof Database, 'execute'>,
	repositoryId: number
) {
	// A GitHub rename can resolve two concurrent fetches to different URLs with
	// the same immutable ID. Serialize intake writes for that identity as well.
	await database.execute(
		sql`SELECT pg_advisory_xact_lock(hashtext('altstack.submission-repository'), hashtext(${String(repositoryId)}))`
	)
}

export const submissionRouter = {
	getById: protectedProcedure.submission.getById.handler(
		async ({ context: { db, auth }, input, errors }) => {
			const [intake] = await db
				.select(intakeColumns)
				.from(project)
				.where(
					and(
						eq(project.id, input.params.id),
						eq(project.submitterId, auth.user.id)
					)
				)
				.limit(1)
			// Conceal existence and feedback for foreign records, including from an
			// admin using submitter procedures. Admin review has its own API.
			if (!intake) throw errors.NOT_FOUND()
			requireRejected(intake.status)
			return { ...intake, status: 'rejected' as const }
		}
	),
	resubmit: protectedProcedure.submission.resubmit
		.use(
			// oRPC beta.42 declares ratelimit's error-map generic as any.
			// oxlint-disable-next-line typescript/no-unsafe-argument
			ratelimit({
				limiter: submissionRateLimiter,
				key: ({ context }) => `user:${context.auth.user.id}`,
			})
		)
		.handler(
			async ({ context: { db, auth }, input: { params, body }, errors }) => {
				const owned = and(
					eq(project.id, params.id),
					eq(project.submitterId, auth.user.id)
				)
				const [existing] = await db
					.select(intakeColumns)
					.from(project)
					.where(owned)
					.limit(1)
				if (!existing) throw errors.NOT_FOUND()
				requireRejected(existing.status)
				requireRevision(existing.revision, body.revision)
				const submitted = canonicalizeGithubUrl(body.repositoryUrl)
				const requireAvailable = async (
					database: Pick<typeof Database, 'select'>,
					urls: Array<string>,
					repositoryId?: number
				) => {
					const [other] = await database
						.select({ id: project.id })
						.from(project)
						.where(
							and(
								ne(project.id, existing.id),
								inArray(canonicalRepositoryKey(project.repositoryUrl), urls)
							)
						)
						.limit(1)
					const [sameIdentity] =
						repositoryId === undefined
							? []
							: await database
									.select({ id: githubRepository.projectId })
									.from(githubRepository)
									.where(
										and(
											ne(githubRepository.projectId, existing.id),
											eq(githubRepository.githubRepositoryId, repositoryId)
										)
									)
									.limit(1)
					if (other || sameIdentity) {
						throw errors.CONFLICT({
							message: 'This repository has already been submitted or listed.',
						})
					}
				}
				await requireAvailable(db, [submitted.canonicalUrl])
				await requireSubmissionCapacity(db, auth.user.id)
				// Always verify existence/aliases, including an unchanged URL. No DB
				// transaction or locks are held across the external request.
				const fetched = await fetchPublicGithubRepository(
					submitted.owner,
					submitted.repo
				)
				const urls = [submitted.canonicalUrl, fetched.canonicalUrl]
				await requireAvailable(db, urls, fetched.githubRepositoryId)
				try {
					return await db.transaction(async (tx) => {
						await lockSubmissionCapacity(tx, auth.user.id)
						const [current] = await tx
							.select(intakeColumns)
							.from(project)
							.where(owned)
							.limit(1)
							.for('update')
						if (!current) throw errors.NOT_FOUND()
						requireRejected(current.status)
						requireRevision(current.revision, body.revision)
						await requireSubmissionCapacity(tx, auth.user.id)
						await lockRepositoryIdentity(tx, fetched.githubRepositoryId)
						await requireAvailable(tx, urls, fetched.githubRepositoryId)
						const [currentGithub] = await tx
							.select()
							.from(githubRepository)
							.where(eq(githubRepository.projectId, existing.id))
							.limit(1)
							.for('update')
						const sameRepository =
							currentGithub?.githubRepositoryId === fetched.githubRepositoryId
						if (!sameRepository) {
							await tx
								.delete(githubStarHistory)
								.where(eq(githubStarHistory.projectId, existing.id))
						}
						await syncProjectTags(tx, existing.id, fetched.topics)
						const basic = {
							githubRepositoryId: fetched.githubRepositoryId,
							owner: fetched.owner,
							repo: fetched.repo,
							stars: fetched.stars,
							forks: fetched.forks,
							licenseKey: fetched.licenseKey,
							licenseName: fetched.licenseName,
							licenseSpdxId: fetched.licenseSpdxId,
							licenseSlug: fetched.licenseSlug,
							licenseUrl: fetched.licenseUrl,
							archived: fetched.archived,

							fetchedAt: new Date(),
						}
						if (currentGithub) {
							// Match admin basic verification: preserve an observed snapshot
							// on rename/transfer; reset all metadata for a different ID.
							await tx
								.update(githubRepository)
								.set({
									...(sameRepository
										? {}
										: { ...emptyGithubMetadata, ...basic }),
									licenseKey: fetched.licenseKey,
									licenseName: fetched.licenseName,
									licenseSpdxId: fetched.licenseSpdxId,
									licenseSlug: fetched.licenseSlug,
									licenseUrl: fetched.licenseUrl,
									archived: fetched.archived,
									githubRepositoryId: fetched.githubRepositoryId,
									owner: fetched.owner,
									repo: fetched.repo,
								})
								.where(eq(githubRepository.projectId, existing.id))
						} else {
							await tx
								.insert(githubRepository)
								.values({ projectId: existing.id, ...basic })
						}
						// Retain ID, slug, original submitter/date, enriched copy, media,
						// and category assignments. Only intake and review state change.
						await tx
							.update(project)
							.set({
								name: body.name,
								repositoryUrl: fetched.canonicalUrl,
								websiteUrl: body.websiteUrl ?? null,
								status: 'draft',
								rejectionReason: null,
							})
							.where(owned)
						await tx.insert(auditLog).values({
							actorId: auth.user.id,
							projectId: existing.id,
							action: 'project_status_changed',
							metadata: {
								fromStatus: 'rejected',
								toStatus: 'draft',
								source: 'submitter_resubmit',
								previousRejectionReason: existing.rejectionReason,
								intake: {
									before: {
										name: existing.name,
										repositoryUrl: existing.repositoryUrl,
										websiteUrl: existing.websiteUrl,
									},
									after: {
										name: body.name,
										repositoryUrl: fetched.canonicalUrl,
										websiteUrl: body.websiteUrl ?? null,
									},
								},
							},
						})
						return { id: existing.id, status: 'draft' as const }
					})
				} catch (error) {
					if (error instanceof ORPCError) throw error
					if (isUniqueViolation(error)) {
						throw errors.CONFLICT({
							message: 'This repository has already been submitted or listed.',
						})
					}
					throw errors.INTERNAL_SERVER_ERROR({
						message: 'Unable to save your resubmission. Please try again.',
					})
				}
			}
		),
	list: protectedProcedure.submission.list.handler(
		async ({ context: { db, auth }, input: { query } }) => {
			// Ownership is always derived from the authenticated session, for both
			// rows and counts. Query parameters cannot select another submitter.
			const where = and(
				eq(project.submitterId, auth.user.id),
				query.q
					? ilike(project.name, `%${query.q.replace(/[\\%_]/g, '\\$&')}%`)
					: undefined
			)
			const [submissions, [total]] = await Promise.all([
				db
					.select({
						id: project.id,
						name: project.name,
						slug: project.slug,
						logo: project.logo,
						repositoryUrl: project.repositoryUrl,
						status: project.status,
						rejectionReason: project.rejectionReason,
						createdAt: project.createdAt,
					})
					.from(project)
					.where(where)
					.orderBy(desc(project.createdAt), desc(project.id))
					.limit(query.limit)
					.offset((query.page - 1) * query.limit),
				db.select({ count: count() }).from(project).where(where),
			])
			const totalItems = total?.count ?? 0
			const totalPages = Math.ceil(totalItems / query.limit)
			return {
				submissions,
				pagination: {
					page: query.page,
					limit: query.limit,
					totalItems,
					totalPages,
					hasNextPage: query.page < totalPages,
					hasPreviousPage: query.page > 1,
				},
			}
		}
	),
	create: protectedProcedure.submission.create
		.use(
			// oRPC beta.42 declares ratelimit's error-map generic as any.
			// oxlint-disable-next-line typescript/no-unsafe-argument
			ratelimit({
				limiter: submissionRateLimiter,
				key: ({ context }) => `user:${context.auth.user.id}`,
			})
		)
		.handler(async ({ context: { db, auth }, input, errors }) => {
			const submitted = canonicalizeGithubUrl(input.repositoryUrl)
			const [existing] = await db
				.select({ id: project.id })
				.from(project)
				.where(
					eq(
						canonicalRepositoryKey(project.repositoryUrl),
						submitted.canonicalUrl
					)
				)
				.limit(1)
			if (existing) {
				throw errors.CONFLICT({
					message: 'This repository has already been submitted or listed.',
				})
			}
			await requireSubmissionCapacity(db, auth.user.id)

			// Quality guidelines are reviewed by an admin; stars are never a gate.
			const {
				canonicalUrl,
				owner,
				repo,
				stars,
				forks,
				githubRepositoryId,
				topics,
				licenseKey,
				licenseName,
				licenseSpdxId,
				licenseSlug,
				licenseUrl,
				archived,
			} = await fetchPublicGithubRepository(submitted.owner, submitted.repo)
			const [resolvedExisting] = await db
				.select({ id: project.id })
				.from(project)
				.where(
					inArray(canonicalRepositoryKey(project.repositoryUrl), [
						submitted.canonicalUrl,
						canonicalUrl,
					])
				)
				.limit(1)
			if (resolvedExisting) {
				throw errors.CONFLICT({
					message: 'This repository has already been submitted or listed.',
				})
			}
			const requireAvailableIdentity = async (
				database: Pick<typeof Database, 'select'>
			) => {
				const [other] = await database
					.select({ id: githubRepository.projectId })
					.from(githubRepository)
					.where(eq(githubRepository.githubRepositoryId, githubRepositoryId))
					.limit(1)
				if (other) {
					throw errors.CONFLICT({
						message: 'This repository has already been submitted or listed.',
					})
				}
			}
			await requireAvailableIdentity(db)
			const baseSlug =
				slugify(input.name).slice(0, 90).replace(/-+$/, '') || 'project'
			try {
				return await db.transaction(async (tx) => {
					// Serialize capacity checks per user, after the GitHub request, so
					// concurrent submissions cannot exceed the cap.
					await lockSubmissionCapacity(tx, auth.user.id)
					await requireSubmissionCapacity(tx, auth.user.id)
					await lockRepositoryIdentity(tx, githubRepositoryId)
					await requireAvailableIdentity(tx)
					// ON CONFLICT only targets the slug. Repository uniqueness still raises
					// 23505, including concurrent submissions, and rolls back everything.
					let inserted: typeof project.$inferSelect | undefined
					let suffix = 1
					while (!inserted) {
						const slug = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`
						;[inserted] = await tx
							.insert(project)
							.values({
								name: input.name,
								slug,
								repositoryUrl: canonicalUrl,
								websiteUrl: input.websiteUrl ?? null,
								status: 'draft',
								submitterId: auth.user.id,
							})
							.onConflictDoNothing({ target: project.slug })
							.returning()
						suffix += 1
					}
					await tx.insert(githubRepository).values({
						projectId: inserted.id,
						githubRepositoryId,
						owner,
						repo,
						stars,
						forks,
						licenseKey,
						licenseName,
						licenseSpdxId,
						licenseSlug,
						licenseUrl,
						archived,
						fetchedAt: new Date(),
					})
					await syncProjectTags(tx, inserted.id, topics)
					await tx.insert(auditLog).values({
						actorId: auth.user.id,
						projectId: inserted.id,
						action: 'project_submitted',
					})
					return { id: inserted.id, status: 'draft' as const }
				})
			} catch (error) {
				if (error instanceof ORPCError) throw error
				if (isUniqueViolation(error)) {
					throw errors.CONFLICT({
						message: 'This repository has already been submitted or listed.',
					})
				}
				throw errors.INTERNAL_SERVER_ERROR({
					message: 'Unable to save your submission. Please try again.',
				})
			}
		}),
}
