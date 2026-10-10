import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'

import { githubDetail } from '@altstack/api/github-refresh'
import { publicProcedure } from '@altstack/api/procedures'
import {
	getDirectProjectCategories,
	listPublicCategories,
	projectInCategorySubtree,
} from '@altstack/api/queries/category'

import {
	category,
	githubRepository,
	project,
	projectCategory,
} from '@altstack/db/schemas'

import { projectSchema } from '@altstack/shared/schemas/common'

const publicFields = projectSchema.omit({ categories: true })

const getBySlugHandler = publicProcedure.project.getBySlug.handler(
	async ({ context, errors, input }) => {
		const { db } = context

		const [row] = await db
			.select()
			.from(project)
			.where(
				and(
					eq(project.slug, input.params.slug),
					eq(project.status, 'published')
				)
			)
			.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
			.limit(1)

		if (!row) {
			throw errors.NOT_FOUND()
		}

		return {
			...publicFields.parse(row.projects),
			categoryDetails: await getDirectProjectCategories(db, row.projects.id),
			screenshot: row.projects.screenshot,
			github: githubDetail(row.github_repositories),
		}
	}
)

const listHandler = publicProcedure.project.list.handler(
	async ({ context, input }) => {
		const { db } = context

		const page = input.query.page
		const limit = input.query.limit
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

			db
				.select({ total: count() })
				.from(project)
				.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
				.where(where),
		])

		if (countRow) total = countRow.total

		const totalPages = Math.ceil(total / limit)
		const hasNextPage = page < totalPages
		const hasPreviousPage = page > 1

		return {
			projects: rows.map((row) => {
				return {
					...publicFields.parse(row.projects),
					screenshot: row.projects.screenshot,
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

const searchHandler = publicProcedure.project.search.handler(
	async ({ context, input }) => {
		const { db } = context

		const page = input.query.page
		const limit = input.query.limit
		const offset = (page - 1) * limit

		// Visibility is decided here, never in the UI: every branch stays
		// limited to published projects.
		const conditions = [eq(project.status, 'published')]

		if (input.query.category) {
			// An unknown slug naturally yields zero matches through EXISTS.
			conditions.push(projectInCategorySubtree(input.query.category))
		}

		if (input.query.q) {
			conditions.push(
				sql`${project.searchVector} @@ websearch_to_tsquery('english', ${input.query.q})`
			)
		}

		const where = and(...conditions)

		const [rows, [countRow]] = await Promise.all([
			db
				.select()
				.from(project)
				.where(where)
				.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
				.orderBy(...searchSortOrder[input.query.sort])
				.limit(limit)
				.offset(offset),

			db
				.select({ total: count() })
				.from(project)
				.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
				.where(where),
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
					...publicFields.parse(row.projects),
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
		const nodes = await listPublicCategories(db)
		return {
			categories: nodes.map(({ slug, name }) => {
				return { slug, name }
			}),
		}
	}
)

export const projectRouter = {
	getBySlug: getBySlugHandler,
	list: listHandler,
	search: searchHandler,
	listCategories: listCategoriesHandler,
}
