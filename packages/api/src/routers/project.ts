import { and, asc, count, desc, eq, exists, inArray, sql } from 'drizzle-orm'

import { publicProcedure } from '@altstack/api/procedures'

import {
	category,
	githubRepository,
	project,
	projectCategory,
} from '@altstack/db/schemas'

const getBySlugHandler = publicProcedure.project.getBySlug.handler(
	async ({ context, errors, input }) => {
		const { db } = context

		const [row] = await db
			.select()
			.from(project)
			.where(and(eq(project.slug, input.slug), eq(project.status, 'published')))
			.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
			.limit(1)

		if (!row) {
			throw errors.NOT_FOUND()
		}

		return {
			...row.projects,
			github: {
				owner: row.github_repositories.owner,
				repo: row.github_repositories.repo,
				stars: row.github_repositories.stars,
				forks: row.github_repositories.forks,
				fetchedAt: row.github_repositories.fetchedAt,
			},
		}
	}
)

const listHandler = publicProcedure.project.list.handler(
	async ({ context, input }) => {
		const { db } = context

		const page = input.page
		const limit = input.limit
		const offset = (page - 1) * limit
		const where = eq(project.status, 'published')
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

			db.select({ total: count() }).from(project).where(where),
		])

		if (countRow) total = countRow.total

		const totalPages = Math.ceil(total / limit)
		const hasNextPage = page < totalPages
		const hasPreviousPage = page > 1

		return {
			projects: rows.map((row) => {
				return {
					...row.projects,
					github: {
						owner: row.github_repositories.owner,
						repo: row.github_repositories.repo,
						stars: row.github_repositories.stars,
						forks: row.github_repositories.forks,
						fetchedAt: row.github_repositories.fetchedAt,
					},
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
// Sort whitelist: client enum values map to fixed server-side orderings.
// Never accept a column name from the client. Each ordering ends with the
// primary key so OFFSET pagination is stable across pages.
const searchSortOrder = {
	newest: [desc(project.createdAt), desc(project.id)],
	oldest: [asc(project.createdAt), asc(project.id)],
	name: [asc(project.name), asc(project.id)],
	'most-stars': [desc(githubRepository.stars), desc(project.id)],
	'most-forks': [desc(githubRepository.forks), desc(project.id)],
} as const

function emptySearchPage(page: number, limit: number) {
	return {
		projects: [],
		pagination: {
			page,
			limit,
			totalItems: 0,
			totalPages: 0,
			hasNextPage: false,
			hasPreviousPage: page > 1,
		},
	}
}

const searchHandler = publicProcedure.project.search.handler(
	async ({ context, input }) => {
		const { db } = context

		const page = input.page
		const limit = input.limit
		const offset = (page - 1) * limit

		// Visibility is decided here, never in the UI: every branch stays
		// limited to published projects.
		const conditions = [eq(project.status, 'published')]

		if (input.category) {
			const [categoryRow] = await db
				.select({ id: category.id })
				.from(category)
				.where(eq(category.slug, input.category))
				.limit(1)

			// Unknown category slug is a valid filter with zero matches.
			if (!categoryRow) {
				return emptySearchPage(page, limit)
			}

			// EXISTS (not JOIN): a project in N categories must still appear once.
			conditions.push(
				exists(
					db
						.select({ one: sql`1` })
						.from(projectCategory)
						.where(
							and(
								eq(projectCategory.projectId, project.id),
								eq(projectCategory.categoryId, categoryRow.id)
							)
						)
				)
			)
		}

		if (input.q) {
			conditions.push(
				sql`${project.searchVector} @@ websearch_to_tsquery('english', ${input.q})`
			)
		}

		const where = and(...conditions)

		const [rows, [countRow]] = await Promise.all([
			db
				.select()
				.from(project)
				.where(where)
				.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
				.orderBy(...searchSortOrder[input.sort])
				.limit(limit)
				.offset(offset),

			db.select({ total: count() }).from(project).where(where),
		])

		// One extra query for the whole page (never N+1).
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

		let total = 0
		if (countRow) total = countRow.total

		const totalPages = Math.ceil(total / limit)
		const hasNextPage = page < totalPages
		const hasPreviousPage = page > 1

		return {
			projects: rows.map((row) => {
				return {
					...row.projects,
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

const listCategoriesHandler = publicProcedure.project.listCategories.handler(
	async ({ context }) => {
		const { db } = context

		// Only categories attached to at least one published project, so the
		// filter UI never offers a dead-end option.
		const rows = await db
			.selectDistinct({ slug: category.slug, name: category.name })
			.from(category)
			.innerJoin(projectCategory, eq(projectCategory.categoryId, category.id))
			.innerJoin(
				project,
				and(
					eq(project.id, projectCategory.projectId),
					eq(project.status, 'published')
				)
			)
			.orderBy(asc(category.name))

		return { categories: rows }
	}
)

export const projectRouter = {
	getBySlug: getBySlugHandler,
	list: listHandler,
	search: searchHandler,
	listCategories: listCategoriesHandler,
}
