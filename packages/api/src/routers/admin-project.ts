import type { ORPCErrorConstructorMap } from '@orpc/server'
import { asc, count, desc, eq, inArray } from 'drizzle-orm'
import { RequestError } from 'octokit'

import { octokit } from '@altstack/api/github'
import { adminProcedure } from '@altstack/api/procedures'

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

		const categoryRows = await db
			.select({ id: category.id, slug: category.slug })
			.from(category)
			.where(inArray(category.slug, uniqueCategorySlugs))

		const categoryIdBySlug = new Map(
			categoryRows.map((row) => [row.slug, row.id])
		)

		const categoryIds: Array<string> = []
		for (const slug of uniqueCategorySlugs) {
			const categoryId = categoryIdBySlug.get(slug)
			if (!categoryId) throw errors.BAD_REQUEST()
			categoryIds.push(categoryId)
		}

		const { forks, stars } = await fetchGithub(owner, repo, errors)

		try {
			return await db.transaction(async (tx) => {
				const [inserted] = await tx
					.insert(project)
					.values({
						name: input.name,
						slug: input.slug,
						repositoryUrl: canonicalUrl,
						tagline: input.tagline,
						description: input.description,
						logo: input.logo,
						websiteUrl: input.websiteUrl ?? null,
						content: input.content ?? null,
						status: 'published',
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
					categories: uniqueCategorySlugs,
					github: { owner, repo, stars, forks, fetchedAt },
				}
			})
		} catch (error) {
			if (isUniqueViolation(error)) throw errors.CONFLICT()
			throw error
		}
	}
)

const adminListProjectHandler = adminProcedure.admin.project.list.handler(
	async ({ context, input }) => {
		const { db } = context

		const page = input.page
		const limit = input.limit
		const offset = (page - 1) * limit
		const where = input.status ? eq(project.status, input.status) : undefined
		let total = 0

		const [rows, [countRow]] = await Promise.all([
			db
				.select()
				.from(project)
				.where(where)
				.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
				.limit(limit)
				.offset(offset)
				.orderBy(desc(project.createdAt), desc(project.id)),

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
	list: adminListProjectHandler,
	listCategories: adminListCategoriesHandler,
}
