import { ORPCError } from '@orpc/server'
import {
	and,
	asc,
	count,
	desc,
	eq,
	getTableColumns,
	ilike,
	inArray,
	isNotNull,
	ne,
	sql,
} from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import {
	fetchPublicGithubMetadata,
	fetchPublicGithubRepository,
} from '@altstack/api/github'
import { adminProcedure } from '@altstack/api/procedures'
import {
	lockCategoryIntegrity,
	validateLeafCategoryAssignments,
} from '@altstack/api/queries/category-integrity'
import { isUniqueViolation } from '@altstack/api/queries/pg-error'
import {
	copyS3Object,
	deleteFinalKeysBestEffort,
	InvalidTempUploadError,
	promoteTempImageToProject,
	TempUploadMissingError,
} from '@altstack/api/storage'

import type { db as Database } from '@altstack/db'
import {
	auditLog,
	category,
	githubRepository,
	project,
	projectCategory,
	user,
} from '@altstack/db/schemas'
import { canonicalRepositoryKey } from '@altstack/db/schemas/project'

import { canonicalizeGithubUrl } from '@altstack/shared'
import { PROJECT_STATUS } from '@altstack/shared/constants'
import {
	adminProjectReviewActionSchema,
	adminUpdateProjectBodySchema,
	publishProjectSchema,
} from '@altstack/shared/schemas/admin-project'

function requirePublishable(value: unknown) {
	const result = publishProjectSchema.safeParse(value)
	if (!result.success) {
		throw new ORPCError('BAD_REQUEST', {
			message:
				'Cannot publish: ' +
				result.error.issues
					.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
					.join('; '),
		})
	}
}

async function getSubmitter(
	database: Pick<typeof Database, 'select'>,
	id: string | null
) {
	if (!id) return null
	const [submitter] = await database
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			image: user.image,
		})
		.from(user)
		.where(eq(user.id, id))
		.limit(1)
	return submitter ?? null
}

async function assignedCategorySlugs(
	database: Pick<typeof Database, 'select'>,
	id: string
) {
	const rows = await database
		.select({ slug: category.slug })
		.from(projectCategory)
		.innerJoin(category, eq(projectCategory.categoryId, category.id))
		.where(eq(projectCategory.projectId, id))
	return rows.map((row) => row.slug)
}

async function validateCategories(
	database: Parameters<typeof validateLeafCategoryAssignments>[0],
	slugs: Array<string>,
	published: boolean
) {
	if (!published && slugs.length === 0) return []
	return validateLeafCategoryAssignments(database, slugs)
}

const adminCreateProjectHandler = adminProcedure.admin.project.create.handler(
	async ({ context, errors, input }) => {
		const { auth, db } = context

		let canonicalUrl: string
		let owner: string
		let repo: string
		try {
			;({ canonicalUrl, owner, repo } = canonicalizeGithubUrl(
				input.body.repositoryUrl
			))
		} catch {
			throw errors.BAD_REQUEST()
		}

		const [[existingProject], [existingSlug]] = await Promise.all([
			db
				.select({ id: project.id })
				.from(project)
				.where(eq(canonicalRepositoryKey(project.repositoryUrl), canonicalUrl))
				.limit(1),

			db
				.select({ id: project.id })
				.from(project)
				.where(eq(project.slug, input.body.slug))
				.limit(1),
		])

		if (existingProject || existingSlug) throw errors.CONFLICT()

		const uniqueCategorySlugs = [...new Set(input.body.categorySlugs)]

		if (input.body.status === 'published') requirePublishable(input.body)
		await validateCategories(
			db,
			uniqueCategorySlugs,
			input.body.status === 'published'
		)

		const resolved = await fetchPublicGithubRepository(owner, repo)
		const [resolvedExisting] = await db
			.select({ id: project.id })
			.from(project)
			.where(
				inArray(canonicalRepositoryKey(project.repositoryUrl), [
					canonicalUrl,
					resolved.canonicalUrl,
				])
			)
			.limit(1)
		if (resolvedExisting) throw errors.CONFLICT()
		;({ canonicalUrl, owner, repo } = resolved)
		const { forks, stars } = resolved

		// Uploads land in tmp/logos|tmp/screenshots first. Only on real submit
		// do we copy to projects/{slug}/logo|screenshot-{uuid}.ext and store
		// the final key. Temp orphans expire via S3 lifecycle on tmp/*.
		let finalLogoKey: string | null = null
		let finalScreenshotKey: string | null = null
		const promotedKeys: Array<string> = []
		try {
			if (input.body.logo) {
				finalLogoKey = await promoteTempImageToProject({
					tmpKey: input.body.logo,
					slug: input.body.slug,
					kind: 'logo',
				})
				promotedKeys.push(finalLogoKey)
			}

			if (input.body.screenshot) {
				finalScreenshotKey = await promoteTempImageToProject({
					tmpKey: input.body.screenshot,
					slug: input.body.slug,
					kind: 'screenshot',
				})
				promotedKeys.push(finalScreenshotKey)
			}
		} catch (error) {
			// A later promote can fail after an earlier one succeeded (e.g.
			// screenshot tmp missing) — clean up what was already promoted
			// so no orphan final objects are left without a DB row.
			await deleteFinalKeysBestEffort(promotedKeys)
			if (
				error instanceof TempUploadMissingError ||
				error instanceof InvalidTempUploadError
			) {
				throw errors.UPLOAD_EXPIRED()
			}
			// A non-empty promotedKeys means at least one tmp key was already
			// deleted, so retrying with the same keys cannot succeed.
			if (promotedKeys.length > 0) throw errors.UPLOAD_CONSUMED()
			throw errors.INTERNAL_SERVER_ERROR()
		}

		try {
			return await db.transaction(async (tx) => {
				await lockCategoryIntegrity(tx)
				const categoryIds = await validateCategories(
					tx,
					uniqueCategorySlugs,
					input.body.status === 'published'
				)
				const [inserted] = await tx
					.insert(project)
					.values({
						name: input.body.name,
						slug: input.body.slug,
						repositoryUrl: canonicalUrl,
						tagline: input.body.tagline ?? null,
						description: input.body.description ?? null,
						logo: finalLogoKey,
						screenshot: finalScreenshotKey,
						websiteUrl: input.body.websiteUrl ?? null,
						content: input.body.content ?? null,
						// input.body.status defaults to 'published' in the shared
						// schema when omitted; draft stays hidden from the
						// public catalogue.
						status: input.body.status,
					})
					.returning()

				if (!inserted) throw errors.INTERNAL_SERVER_ERROR()

				const fetchedAt = new Date()

				await tx.insert(githubRepository).values({
					projectId: inserted.id,
					owner,
					repo,
					stars,
					forks,
					fetchedAt,
				})

				if (categoryIds.length > 0) {
					await tx.insert(projectCategory).values(
						categoryIds.map((categoryId) => {
							return {
								projectId: inserted.id,
								categoryId,
							}
						})
					)
				}

				await tx.insert(auditLog).values({
					actorId: auth.user.id,
					action: 'project_created',
					projectId: inserted.id,
					metadata: { status: inserted.status },
				})

				const { searchVector: _searchVector, ...rest } = inserted
				void _searchVector

				return {
					...rest,
					submitter: null,
					logo: rest.logo,
					screenshot: rest.screenshot,
					categories: uniqueCategorySlugs,
					github: { owner, repo, stars, forks, fetchedAt },
				}
			})
		} catch (error) {
			// Promote already copied to final keys; clean them up so a failed
			// insert (e.g. slug race → 409) doesn't leave orphan finals.
			await deleteFinalKeysBestEffort(promotedKeys)
			// Unique violation here is always post-promote (tmp keys already
			// deleted), so use a distinct code from the preflight CONFLICT
			// above where the uploads are still alive.
			if (isUniqueViolation(error)) {
				throw promotedKeys.length > 0
					? errors.CONFLICT_AFTER_PROMOTE()
					: errors.CONFLICT()
			}
			// Any other failure here is also post-promote: the tmp uploads
			// are already consumed, so report that instead of a generic
			// 500 the form would retry with dead keys.
			if (promotedKeys.length === 0 && error instanceof ORPCError) throw error
			throw promotedKeys.length > 0
				? errors.UPLOAD_CONSUMED()
				: errors.INTERNAL_SERVER_ERROR()
		}
	}
)

const adminGetProjectByIdHandler = adminProcedure.admin.project.getById.handler(
	async ({ context, errors, input }) => {
		const { db } = context

		const [row] = await db
			.select()
			.from(project)
			.where(eq(project.id, input.params.id))
			.limit(1)

		if (!row) throw errors.NOT_FOUND()

		const [githubRow] = await db
			.select()
			.from(githubRepository)
			.where(eq(githubRepository.projectId, input.params.id))
			.limit(1)

		if (!githubRow) throw errors.INTERNAL_SERVER_ERROR()

		const categoryRows = await db
			.select({ slug: category.slug })
			.from(projectCategory)
			.innerJoin(category, eq(projectCategory.categoryId, category.id))
			.where(eq(projectCategory.projectId, input.params.id))

		const { searchVector: _searchVector, ...rest } = row
		void _searchVector

		return {
			...rest,
			submitter: await getSubmitter(db, rest.submitterId),
			logo: rest.logo,
			screenshot: rest.screenshot,
			categories: categoryRows.map((categoryRow) => categoryRow.slug),
			github: {
				owner: githubRow.owner,
				repo: githubRow.repo,
				stars: githubRow.stars,
				forks: githubRow.forks,
				fetchedAt: githubRow.fetchedAt,
			},
		}
	}
)

const adminUpdateProjectHandler = adminProcedure.admin.project.update.handler(
	async ({ context: { auth, db }, input, errors }) => {
		const body = input.body ?? adminUpdateProjectBodySchema.parse({})
		const promotedKeys: Array<string> = []
		const staleKeys: Array<string> = []
		const promotion = { consumed: false }
		try {
			const [existing] = await db
				.select({
					...getTableColumns(project),
					revision: sql<string>`xmin::text`,
				})
				.from(project)
				.where(eq(project.id, input.params.id))
				.limit(1)
			if (!existing) throw errors.NOT_FOUND()
			const submitted = canonicalizeGithubUrl(
				body.repositoryUrl ?? existing.repositoryUrl
			)
			let repository = submitted
			const targetSlug = body.slug ?? existing.slug
			const status = body.status ?? existing.status
			const originalCategorySlugs = await assignedCategorySlugs(db, existing.id)
			const categorySlugs = body.categorySlugs ?? originalCategorySlugs
			const merged = {
				...existing,
				...body,
				name: body.name ?? existing.name,
				tagline: body.tagline === undefined ? existing.tagline : body.tagline,
				description:
					body.description === undefined
						? existing.description
						: body.description,
				slug: targetSlug,
				repositoryUrl: repository.canonicalUrl,
				logo: body.logo === undefined ? existing.logo : body.logo,
				categorySlugs,
			}
			if (status === 'published') requirePublishable(merged)
			await validateCategories(db, categorySlugs, status === 'published')
			if (
				body.rejectionReason !== undefined &&
				status !== 'rejected' &&
				body.rejectionReason !== null
			) {
				throw errors.BAD_REQUEST({
					message: 'A rejection reason requires rejected status.',
				})
			}
			const [repoOwner] = await db
				.select({ id: project.id })
				.from(project)
				.where(
					eq(
						canonicalRepositoryKey(project.repositoryUrl),
						repository.canonicalUrl
					)
				)
				.limit(1)
			const [slugOwner] = await db
				.select({ id: project.id })
				.from(project)
				.where(eq(project.slug, targetSlug))
				.limit(1)
			if (
				(repoOwner && repoOwner.id !== existing.id) ||
				(slugOwner && slugOwner.id !== existing.id)
			) {
				throw errors.CONFLICT()
			}
			const refreshedGithub =
				repository.canonicalUrl !== existing.repositoryUrl
					? await fetchPublicGithubRepository(repository.owner, repository.repo)
					: undefined
			if (refreshedGithub) repository = refreshedGithub
			const requireAvailableRepository = async (
				database: Pick<typeof Database, 'select'>
			) => {
				const [other] = await database
					.select({ id: project.id })
					.from(project)
					.where(
						and(
							ne(project.id, existing.id),
							inArray(canonicalRepositoryKey(project.repositoryUrl), [
								submitted.canonicalUrl,
								repository.canonicalUrl,
							])
						)
					)
					.limit(1)
				if (other) throw errors.CONFLICT()
			}
			await requireAvailableRepository(db)

			let logo = existing.logo
			let screenshot = existing.screenshot
			if (body.logo !== undefined) {
				if (body.logo === null) logo = null
				else {
					logo = await promoteTempImageToProject({
						tmpKey: body.logo,
						slug: targetSlug,
						kind: 'logo',
					})
					promotedKeys.push(logo)
					promotion.consumed = true
				}
				if (existing.logo) staleKeys.push(existing.logo)
			}
			if (body.screenshot !== undefined) {
				if (body.screenshot === null) screenshot = null
				else {
					screenshot = await promoteTempImageToProject({
						tmpKey: body.screenshot,
						slug: targetSlug,
						kind: 'screenshot',
					})
					promotedKeys.push(screenshot)
					promotion.consumed = true
				}
				if (existing.screenshot) staleKeys.push(existing.screenshot)
			}
			const copyIntoSlug = async (key: string, kind: 'logo' | 'screenshot') => {
				const prefix = `projects/${existing.slug}/`
				if (!key.startsWith(prefix)) return key
				// Each attempt owns its copies, so cleanup after a stale edit cannot
				// delete a concurrent winner's objects.
				const extension = /\.[^/.]+$/.exec(key)?.[0] ?? ''
				const next = `projects/${targetSlug}/${kind}-${randomUUID()}${extension}`
				await copyS3Object(key, next)
				promotedKeys.push(next)
				staleKeys.push(key)
				return next
			}
			if (targetSlug !== existing.slug) {
				if (body.logo === undefined && logo) {
					logo = await copyIntoSlug(logo, 'logo')
				}
				if (body.screenshot === undefined && screenshot) {
					screenshot = await copyIntoSlug(screenshot, 'screenshot')
				}
			}
			const result = await db.transaction(async (tx) => {
				// GitHub and media work is complete before these locks are acquired.
				await lockCategoryIntegrity(tx)
				const [current] = await tx
					.select({ revision: sql<string>`xmin::text` })
					.from(project)
					.where(eq(project.id, existing.id))
					.limit(1)
					.for('update')
				if (!current) throw errors.NOT_FOUND()
				const currentCategorySlugs = await assignedCategorySlugs(
					tx,
					existing.id
				)
				if (
					current.revision !== existing.revision ||
					JSON.stringify(currentCategorySlugs.toSorted()) !==
						JSON.stringify(originalCategorySlugs.toSorted())
				) {
					throw errors.CONFLICT({
						message:
							'This project changed while the update was prepared. Reload it and try again.',
					})
				}
				if (status === 'published') {
					requirePublishable({
						...merged,
						repositoryUrl: repository.canonicalUrl,
					})
				}
				const categoryIds = await validateCategories(
					tx,
					categorySlugs,
					status === 'published'
				)
				await requireAvailableRepository(tx)
				const [updated] = await tx
					.update(project)
					.set({
						name: body.name ?? existing.name,
						slug: targetSlug,
						repositoryUrl: repository.canonicalUrl,
						tagline:
							body.tagline === undefined ? existing.tagline : body.tagline,
						description:
							body.description === undefined
								? existing.description
								: body.description,
						logo,
						screenshot,
						status,
						websiteUrl:
							body.websiteUrl === undefined
								? existing.websiteUrl
								: body.websiteUrl,
						content:
							body.content === undefined ? existing.content : body.content,
						rejectionReason:
							status === 'rejected'
								? body.rejectionReason === undefined
									? existing.rejectionReason
									: body.rejectionReason
								: null,
					})
					.where(eq(project.id, existing.id))
					.returning()
				if (!updated) throw errors.INTERNAL_SERVER_ERROR()
				if (body.categorySlugs !== undefined) {
					await tx
						.delete(projectCategory)
						.where(eq(projectCategory.projectId, existing.id))
					if (categoryIds.length > 0) {
						await tx.insert(projectCategory).values(
							categoryIds.map((categoryId) => {
								return {
									projectId: existing.id,
									categoryId,
								}
							})
						)
					}
				}
				if (refreshedGithub) {
					await tx
						.update(githubRepository)
						.set({
							owner: refreshedGithub.owner,
							repo: refreshedGithub.repo,
							stars: refreshedGithub.stars,
							forks: refreshedGithub.forks,
							fetchedAt: new Date(),
						})
						.where(eq(githubRepository.projectId, existing.id))
				}
				await tx.insert(auditLog).values({
					actorId: auth.user.id,
					action: 'project_updated',
					projectId: existing.id,
				})
				if (
					status !== existing.status ||
					updated.rejectionReason !== existing.rejectionReason
				) {
					await tx.insert(auditLog).values({
						actorId: auth.user.id,
						action: 'project_status_changed',
						projectId: existing.id,
						reason: updated.rejectionReason,
						metadata: { fromStatus: existing.status, toStatus: status },
					})
				}
				const [githubRow] = await tx
					.select()
					.from(githubRepository)
					.where(eq(githubRepository.projectId, existing.id))
					.limit(1)
				if (!githubRow) throw errors.INTERNAL_SERVER_ERROR()
				const { searchVector: _searchVector, ...rest } = updated
				void _searchVector
				return {
					...rest,
					submitter: await getSubmitter(tx, rest.submitterId),
					categories: categorySlugs,
					github: {
						owner: githubRow.owner,
						repo: githubRow.repo,
						stars: githubRow.stars,
						forks: githubRow.forks,
						fetchedAt: githubRow.fetchedAt,
					},
				}
			})
			await deleteFinalKeysBestEffort(staleKeys)
			return result
		} catch (error) {
			await deleteFinalKeysBestEffort(promotedKeys)
			if (
				error instanceof TempUploadMissingError ||
				error instanceof InvalidTempUploadError
			) {
				throw errors.UPLOAD_EXPIRED()
			}
			if (isUniqueViolation(error)) {
				throw promotion.consumed
					? errors.CONFLICT_AFTER_PROMOTE()
					: errors.CONFLICT()
			}
			if (!promotion.consumed && error instanceof ORPCError) throw error
			throw promotion.consumed
				? errors.UPLOAD_CONSUMED()
				: errors.INTERNAL_SERVER_ERROR()
		}
	}
)

const adminDeleteProjectHandler = adminProcedure.admin.project.remove.handler(
	async ({ context, errors, input }) => {
		const { auth, db } = context

		const [existing] = await db
			.select({
				id: project.id,
				logo: project.logo,
				screenshot: project.screenshot,
			})
			.from(project)
			.where(eq(project.id, input.params.id))
			.limit(1)

		if (!existing) throw errors.NOT_FOUND()

		try {
			await db.transaction(async (tx) => {
				await lockCategoryIntegrity(tx)
				await tx.insert(auditLog).values({
					actorId: auth.user.id,
					action: 'project_removed',
					projectId: existing.id,
				})
				// githubRepository and projectCategory rows cascade.
				await tx.delete(project).where(eq(project.id, existing.id))
			})
		} catch {
			throw errors.INTERNAL_SERVER_ERROR()
		}

		// Best-effort: the DB row is gone, so leftover finals would be
		// orphans with no lifecycle covering projects/*.
		await deleteFinalKeysBestEffort(
			[existing.logo, existing.screenshot].filter(
				(key): key is string => key !== null
			)
		)

		return { success: true as const }
	}
)

const adminListProjectHandler = adminProcedure.admin.project.list.handler(
	async ({ context, input }) => {
		const { db } = context

		const page = input.query.page
		const limit = input.query.limit
		const offset = (page - 1) * limit
		const where = and(
			input.query.status ? eq(project.status, input.query.status) : undefined,
			input.query.needsReview
				? and(eq(project.status, 'draft'), isNotNull(project.submitterId))
				: undefined,
			input.query.name
				? ilike(
						project.name,
						`%${input.query.name.replace(/[\\%_]/g, '\\$&')}%`
					)
				: undefined
		)
		const sortColumn =
			input.query.sort === 'name' ? project.name : project.createdAt
		const order = input.query.order === 'asc' ? asc : desc
		let total = 0

		const [rows, [countRow]] = await Promise.all([
			db
				.select()
				.from(project)
				.where(where)
				.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
				.leftJoin(user, eq(project.submitterId, user.id))
				.orderBy(order(sortColumn), order(project.id))
				.limit(limit)
				.offset(offset),

			db
				.select({ total: count() })
				.from(project)
				.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
				.where(where),
		])

		const ids = rows.map((row) => row.projects.id)

		const categoryRows =
			ids.length > 0
				? await db
						.select({
							projectId: projectCategory.projectId,
							slug: category.slug,
						})
						.from(projectCategory)
						.innerJoin(category, eq(projectCategory.categoryId, category.id))
						.where(inArray(projectCategory.projectId, ids))
				: []

		const slugsByProject = new Map<string, Array<string>>()

		for (const row of categoryRows) {
			const slugs = slugsByProject.get(row.projectId) ?? []
			slugs.push(row.slug)
			slugsByProject.set(row.projectId, slugs)
		}

		if (countRow) total = countRow.total

		const totalPages = Math.ceil(total / limit)
		const hasNextPage = page < totalPages
		const hasPreviousPage = page > 1

		return {
			projects: rows.map((row) => {
				const { searchVector: _searchVector, ...rest } = row.projects
				void _searchVector
				return {
					...rest,
					submitter: row.user
						? {
								id: row.user.id,
								name: row.user.name,
								email: row.user.email,
								image: row.user.image,
							}
						: null,
					logo: rest.logo,
					screenshot: rest.screenshot,
					github: {
						owner: row.github_repositories.owner,
						repo: row.github_repositories.repo,
						stars: row.github_repositories.stars,
						forks: row.github_repositories.forks,
						fetchedAt: row.github_repositories.fetchedAt,
					},
					categories: slugsByProject.get(row.projects.id) ?? [],
				}
			}),
			pagination: {
				page,
				limit,
				totalItems: total,
				totalPages,
				hasNextPage,
				hasPreviousPage,
			},
		}
	}
)

const adminListCategoriesHandler =
	adminProcedure.admin.project.listCategories.handler(async ({ context }) => {
		const { db } = context

		// No published-project join here: the creation form must offer every
		// category, including ones with no published projects yet.
		const rows = await db
			.select({ slug: category.slug, name: category.name })
			.from(category)
			.orderBy(asc(category.name))

		return { categories: rows }
	})

// Historical JSON is untrusted. Validate each status independently so a bad
// field does not hide another valid field or manufacture a transition.
const reviewMetadataSchema = z.object({
	status: z.enum(PROJECT_STATUS).nullable().catch(null),
	fromStatus: z.enum(PROJECT_STATUS).nullable().catch(null),
	toStatus: z.enum(PROJECT_STATUS).nullable().catch(null),
})

const adminProjectReviewHistoryHandler =
	adminProcedure.admin.project.reviewHistory.handler(
		async ({ context: { db }, input, errors }) => {
			const [existing] = await db
				.select({ id: project.id })
				.from(project)
				.where(eq(project.id, input.params.id))
				.limit(1)
			if (!existing) throw errors.NOT_FOUND()

			const { page, limit } = input.query
			const where = and(
				eq(auditLog.projectId, input.params.id),
				inArray(auditLog.action, adminProjectReviewActionSchema.options)
			)
			const [rows, [countRow]] = await Promise.all([
				db
					.select({
						id: auditLog.id,
						action: auditLog.action,
						createdAt: auditLog.createdAt,
						reason: auditLog.reason,
						metadata: auditLog.metadata,
						actor: { id: user.id, name: user.name },
					})
					.from(auditLog)
					.leftJoin(user, eq(auditLog.actorId, user.id))
					.where(where)
					.orderBy(desc(auditLog.createdAt), desc(auditLog.id))
					.limit(limit)
					.offset((page - 1) * limit),
				db.select({ total: count() }).from(auditLog).where(where),
			])
			const totalItems = countRow?.total ?? 0
			const totalPages = Math.ceil(totalItems / limit)
			return {
				events: rows.map((row) => {
					const action = adminProjectReviewActionSchema.parse(row.action)
					const metadata = reviewMetadataSchema.safeParse(row.metadata)
					const statuses = metadata.success ? metadata.data : null
					return {
						id: row.id,
						action,
						createdAt: row.createdAt,
						actor: row.actor,
						reason: row.reason,
						fromStatus:
							action === 'project_status_changed'
								? (statuses?.fromStatus ?? null)
								: null,
						toStatus:
							action === 'project_submitted'
								? ('draft' as const)
								: action === 'project_created'
									? (statuses?.status ?? null)
									: (statuses?.toStatus ?? null),
					}
				}),
				pagination: {
					page,
					limit,
					totalItems,
					totalPages,
					hasNextPage: page < totalPages,
					hasPreviousPage: page > 1,
				},
			}
		}
	)

export const adminProjectRouter = {
	githubMetadata: adminProcedure.admin.project.githubMetadata.handler(
		async ({ input }) => {
			const { owner, repo } = canonicalizeGithubUrl(input.repositoryUrl)
			return fetchPublicGithubMetadata(owner, repo)
		}
	),
	create: adminCreateProjectHandler,
	getById: adminGetProjectByIdHandler,
	update: adminUpdateProjectHandler,
	remove: adminDeleteProjectHandler,
	list: adminListProjectHandler,
	reviewHistory: adminProjectReviewHistoryHandler,
	listCategories: adminListCategoriesHandler,
}
