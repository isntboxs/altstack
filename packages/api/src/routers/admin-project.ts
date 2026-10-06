import { ORPCError } from '@orpc/server'
import type { ORPCErrorConstructorMap } from '@orpc/server'
import { and, asc, count, desc, eq, ilike, inArray } from 'drizzle-orm'
import { RequestError } from 'octokit'

import { octokit } from '@altstack/api/github'
import { adminProcedure } from '@altstack/api/procedures'
import {
	lockCategoryIntegrity,
	validateLeafCategoryAssignments,
} from '@altstack/api/queries/category-integrity'
import {
	copyS3Object,
	deleteFinalKeysBestEffort,
	InvalidTempUploadError,
	promoteTempImageToProject,
	TempUploadMissingError,
} from '@altstack/api/storage'

import {
	auditLog,
	category,
	githubRepository,
	project,
	projectCategory,
} from '@altstack/db/schemas'

import { canonicalizeGithubUrl } from '@altstack/shared'
import type { ORPC_ERRORS } from '@altstack/shared/constants/orpc-errors'

function hasPgCode(value: unknown, code: string): boolean {
	return (
		typeof value === 'object' &&
		value !== null &&
		'code' in value &&
		value.code === code
	)
}

function isUniqueViolation(error: unknown): boolean {
	if (hasPgCode(error, '23505')) return true

	if (
		typeof error === 'object' &&
		error !== null &&
		'cause' in error &&
		hasPgCode(error.cause, '23505')
	) {
		return true
	}

	return false
}

async function fetchGithub(
	owner: string,
	repo: string,
	errors: ORPCErrorConstructorMap<typeof ORPC_ERRORS>
) {
	try {
		const { data } = await octokit.rest.repos.get({ owner, repo })
		return { stars: data.stargazers_count, forks: data.forks_count }
	} catch (e) {
		if (e instanceof RequestError) {
			if (e.status === 404) throw errors.NOT_FOUND()
			if (e.status === 403 || e.status === 429) throw errors.TOO_MANY_REQUESTS()
			throw errors.INTERNAL_SERVER_ERROR()
		}
		throw e
	}
}

const adminCreateProjectHandler = adminProcedure.admin.project.create.handler(
	async ({ context, errors, input }) => {
		const { auth, db } = context

		let canonicalUrl: string
		let owner: string
		let repo: string
		try {
			;({ canonicalUrl, owner, repo } = canonicalizeGithubUrl(
				input.repositoryUrl
			))
		} catch {
			throw errors.BAD_REQUEST()
		}

		const [[existingProject], [existingSlug]] = await Promise.all([
			db
				.select({ id: project.id })
				.from(project)
				.where(eq(project.repositoryUrl, canonicalUrl))
				.limit(1),

			db
				.select({ id: project.id })
				.from(project)
				.where(eq(project.slug, input.slug))
				.limit(1),
		])

		if (existingProject || existingSlug) throw errors.CONFLICT()

		const uniqueCategorySlugs = [...new Set(input.categorySlugs)]

		await validateLeafCategoryAssignments(db, uniqueCategorySlugs)

		const { forks, stars } = await fetchGithub(owner, repo, errors)

		// Uploads land in tmp/logos|tmp/screenshots first. Only on real submit
		// do we copy to projects/{slug}/logo|screenshot-{uuid}.ext and store
		// the final key. Temp orphans expire via S3 lifecycle on tmp/*.
		let finalLogoKey: string
		let finalScreenshotKey: string | null = null
		const promotedKeys: Array<string> = []
		try {
			finalLogoKey = await promoteTempImageToProject({
				tmpKey: input.logo,
				slug: input.slug,
				kind: 'logo',
			})
			promotedKeys.push(finalLogoKey)

			if (input.screenshot) {
				finalScreenshotKey = await promoteTempImageToProject({
					tmpKey: input.screenshot,
					slug: input.slug,
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
				const categoryIds = await validateLeafCategoryAssignments(
					tx,
					uniqueCategorySlugs
				)
				const [inserted] = await tx
					.insert(project)
					.values({
						name: input.name,
						slug: input.slug,
						repositoryUrl: canonicalUrl,
						tagline: input.tagline,
						description: input.description,
						logo: finalLogoKey,
						screenshot: finalScreenshotKey,
						websiteUrl: input.websiteUrl ?? null,
						content: input.content ?? null,
						// input.status defaults to 'published' in the shared
						// schema when omitted; draft stays hidden from the
						// public catalogue.
						status: input.status,
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

				await tx.insert(projectCategory).values(
					categoryIds.map((categoryId) => {
						return {
							projectId: inserted.id,
							categoryId,
						}
					})
				)

				await tx.insert(auditLog).values({
					actorId: auth.user.id,
					action: 'project_created',
					projectId: inserted.id,
				})

				const { searchVector: _searchVector, ...rest } = inserted
				void _searchVector

				return {
					...rest,
					logo: rest.logo,
					screenshot: rest.screenshot,
					categories: uniqueCategorySlugs,
					github: { owner, repo, stars, forks, fetchedAt },
				}
			})
		} catch (error) {
			// Promote already copied to final keys; clean them up so a failed
			// insert (e.g. slug race → 409) doesn't leave orphan finals.
			await deleteFinalKeysBestEffort(
				finalScreenshotKey ? [finalLogoKey, finalScreenshotKey] : [finalLogoKey]
			)
			// Unique violation here is always post-promote (tmp keys already
			// deleted), so use a distinct code from the preflight CONFLICT
			// above where the uploads are still alive.
			if (isUniqueViolation(error)) throw errors.CONFLICT_AFTER_PROMOTE()
			// Any other failure here is also post-promote: the tmp uploads
			// are already consumed, so report that instead of a generic
			// 500 the form would retry with dead keys.
			throw errors.UPLOAD_CONSUMED()
		}
	}
)

const adminGetProjectByIdHandler = adminProcedure.admin.project.getById.handler(
	async ({ context, errors, input }) => {
		const { db } = context

		const [row] = await db
			.select()
			.from(project)
			.where(eq(project.id, input.id))
			.limit(1)

		if (!row) throw errors.NOT_FOUND()

		const [githubRow] = await db
			.select()
			.from(githubRepository)
			.where(eq(githubRepository.projectId, input.id))
			.limit(1)

		if (!githubRow) throw errors.INTERNAL_SERVER_ERROR()

		const categoryRows = await db
			.select({ slug: category.slug })
			.from(projectCategory)
			.innerJoin(category, eq(projectCategory.categoryId, category.id))
			.where(eq(projectCategory.projectId, input.id))

		const { searchVector: _searchVector, ...rest } = row
		void _searchVector

		return {
			...rest,
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
	async ({ context, errors, input }) => {
		const { auth, db } = context

		const [existing] = await db
			.select()
			.from(project)
			.where(eq(project.id, input.id))
			.limit(1)

		if (!existing) throw errors.NOT_FOUND()

		let canonicalUrl: string | undefined
		let nextGithub: { owner: string; repo: string } | undefined
		if (input.repositoryUrl !== undefined) {
			let parsed: { canonicalUrl: string; owner: string; repo: string }
			try {
				parsed = canonicalizeGithubUrl(input.repositoryUrl)
			} catch {
				throw errors.BAD_REQUEST()
			}
			canonicalUrl = parsed.canonicalUrl
			if (canonicalUrl !== existing.repositoryUrl) {
				const [repoOwner] = await db
					.select({ id: project.id })
					.from(project)
					.where(eq(project.repositoryUrl, canonicalUrl))
					.limit(1)
				if (repoOwner) throw errors.CONFLICT()
				nextGithub = { owner: parsed.owner, repo: parsed.repo }
			}
		}

		const targetSlug = input.slug ?? existing.slug
		if (input.slug !== undefined && input.slug !== existing.slug) {
			const [slugOwner] = await db
				.select({ id: project.id })
				.from(project)
				.where(eq(project.slug, input.slug))
				.limit(1)
			if (slugOwner) throw errors.CONFLICT()
		}

		let uniqueCategorySlugs: Array<string> | undefined
		if (input.categorySlugs !== undefined) {
			uniqueCategorySlugs = [...new Set(input.categorySlugs)]
			await validateLeafCategoryAssignments(db, uniqueCategorySlugs)
		}

		let refreshedGithub:
			| { owner: string; repo: string; stars: number; forks: number }
			| undefined
		if (nextGithub) {
			const { forks, stars } = await fetchGithub(
				nextGithub.owner,
				nextGithub.repo,
				errors
			)
			refreshedGithub = { ...nextGithub, stars, forks }
		}

		// New images arrive as tmp keys and are promoted straight into the
		// target slug folder. Kept images move along on slug rename via
		// copy (source deleted only after the DB update succeeds).
		let finalLogoKey = existing.logo
		let finalScreenshotKey = existing.screenshot
		const promotedKeys: Array<string> = []
		const staleKeys: Array<string> = []
		// True once a tmp upload was promoted (its tmp key is deleted).
		// Slug-rename copies below also land in promotedKeys for rollback
		// cleanup, but they consume no tmp upload — retry stays possible.
		let promotedTmp = false
		try {
			if (input.logo !== undefined) {
				finalLogoKey = await promoteTempImageToProject({
					tmpKey: input.logo,
					slug: targetSlug,
					kind: 'logo',
				})
				promotedKeys.push(finalLogoKey)
				promotedTmp = true
				staleKeys.push(existing.logo)
			}

			if (input.screenshot !== undefined) {
				if (input.screenshot === null) {
					if (existing.screenshot) staleKeys.push(existing.screenshot)
					finalScreenshotKey = null
				} else {
					finalScreenshotKey = await promoteTempImageToProject({
						tmpKey: input.screenshot,
						slug: targetSlug,
						kind: 'screenshot',
					})
					promotedKeys.push(finalScreenshotKey)
					promotedTmp = true
					if (existing.screenshot) staleKeys.push(existing.screenshot)
				}
			}

			if (targetSlug !== existing.slug) {
				const oldPrefix = `projects/${existing.slug}/`
				const copyIntoSlug = async (oldKey: string): Promise<string> => {
					// Legacy/external keys (e.g. seed avatars) live outside the
					// slug folder — keep them as-is without tracking.
					if (!oldKey.startsWith(oldPrefix)) {
						return oldKey
					}
					const destKey = `projects/${targetSlug}/${oldKey.slice(oldPrefix.length)}`
					await copyS3Object(oldKey, destKey)
					promotedKeys.push(destKey)
					staleKeys.push(oldKey)
					return destKey
				}

				if (input.logo === undefined) {
					finalLogoKey = await copyIntoSlug(existing.logo)
				}
				if (input.screenshot === undefined && existing.screenshot) {
					finalScreenshotKey = await copyIntoSlug(existing.screenshot)
				}
			}
		} catch (error) {
			await deleteFinalKeysBestEffort(promotedKeys)
			if (
				error instanceof TempUploadMissingError ||
				error instanceof InvalidTempUploadError
			) {
				throw errors.UPLOAD_EXPIRED()
			}
			// Only a promoted tmp upload deletes its tmp key; slug-rename
			// copies alone leave retry possible.
			if (promotedTmp) throw errors.UPLOAD_CONSUMED()
			throw errors.INTERNAL_SERVER_ERROR()
		}

		const patch: Partial<typeof project.$inferInsert> = {
			logo: finalLogoKey,
			screenshot: finalScreenshotKey,
		}
		if (input.name !== undefined) patch.name = input.name
		if (input.slug !== undefined) patch.slug = input.slug
		if (canonicalUrl !== undefined) patch.repositoryUrl = canonicalUrl
		if (input.tagline !== undefined) patch.tagline = input.tagline
		if (input.description !== undefined) patch.description = input.description
		if (input.websiteUrl !== undefined) patch.websiteUrl = input.websiteUrl
		if (input.content !== undefined) patch.content = input.content
		if (input.status !== undefined) patch.status = input.status

		try {
			const result = await db.transaction(async (tx) => {
				let categoryIds: Array<string> | undefined
				if (uniqueCategorySlugs !== undefined) {
					await lockCategoryIntegrity(tx)
					categoryIds = await validateLeafCategoryAssignments(
						tx,
						uniqueCategorySlugs
					)
				}
				const [updated] = await tx
					.update(project)
					.set(patch)
					.where(eq(project.id, input.id))
					.returning()

				if (!updated) throw errors.INTERNAL_SERVER_ERROR()

				if (categoryIds !== undefined) {
					await tx
						.delete(projectCategory)
						.where(eq(projectCategory.projectId, input.id))
					if (categoryIds.length > 0) {
						await tx.insert(projectCategory).values(
							categoryIds.map((categoryId) => {
								return {
									projectId: input.id,
									categoryId,
								}
							})
						)
					}
				}

				if (refreshedGithub) {
					const fetchedAt = new Date()
					await tx
						.update(githubRepository)
						.set({ ...refreshedGithub, fetchedAt })
						.where(eq(githubRepository.projectId, input.id))
				}

				await tx.insert(auditLog).values({
					actorId: auth.user.id,
					action: 'project_updated',
					projectId: input.id,
				})

				const [githubRow] = await tx
					.select()
					.from(githubRepository)
					.where(eq(githubRepository.projectId, input.id))
					.limit(1)

				if (!githubRow) throw errors.INTERNAL_SERVER_ERROR()

				let categorySlugsOut: Array<string>
				if (uniqueCategorySlugs !== undefined) {
					categorySlugsOut = uniqueCategorySlugs
				} else {
					const rows = await tx
						.select({ slug: category.slug })
						.from(projectCategory)
						.innerJoin(category, eq(projectCategory.categoryId, category.id))
						.where(eq(projectCategory.projectId, input.id))
					categorySlugsOut = rows.map((row) => row.slug)
				}

				const { searchVector: _searchVector, ...rest } = updated
				void _searchVector

				return {
					...rest,
					logo: rest.logo,
					screenshot: rest.screenshot,
					categories: categorySlugsOut,
					github: {
						owner: githubRow.owner,
						repo: githubRow.repo,
						stars: githubRow.stars,
						forks: githubRow.forks,
						fetchedAt: githubRow.fetchedAt,
					},
				}
			})

			// DB now points at the new finals — the replaced and moved-from
			// keys are safe to delete. Best-effort: projects/* has no lifecycle.
			await deleteFinalKeysBestEffort(staleKeys)

			return result
		} catch (error) {
			await deleteFinalKeysBestEffort(promotedKeys)
			// Without a promoted tmp upload the submitted keys are still
			// alive, so report preflight-style codes that preserve them.
			if (isUniqueViolation(error)) {
				throw promotedTmp ? errors.CONFLICT_AFTER_PROMOTE() : errors.CONFLICT()
			}
			if (
				!promotedTmp &&
				error instanceof ORPCError &&
				error.code === 'BAD_REQUEST'
			) {
				throw error
			}
			throw promotedTmp
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
			.where(eq(project.id, input.id))
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
			existing.screenshot
				? [existing.logo, existing.screenshot]
				: [existing.logo]
		)

		return { success: true as const }
	}
)

const adminListProjectHandler = adminProcedure.admin.project.list.handler(
	async ({ context, input }) => {
		const { db } = context

		const page = input.page
		const limit = input.limit
		const offset = (page - 1) * limit
		const where = and(
			input.status ? eq(project.status, input.status) : undefined,
			input.name
				? ilike(project.name, `%${input.name.replace(/[\\%_]/g, '\\$&')}%`)
				: undefined
		)
		const sortColumn = input.sort === 'name' ? project.name : project.createdAt
		const order = input.order === 'asc' ? asc : desc
		let total = 0

		const [rows, [countRow]] = await Promise.all([
			db
				.select()
				.from(project)
				.where(where)
				.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
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

export const adminProjectRouter = {
	create: adminCreateProjectHandler,
	getById: adminGetProjectByIdHandler,
	update: adminUpdateProjectHandler,
	remove: adminDeleteProjectHandler,
	list: adminListProjectHandler,
	listCategories: adminListCategoriesHandler,
}
