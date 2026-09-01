import { and, count, desc, eq } from 'drizzle-orm'

import { publicProcedure } from '@altstack/api/procedures'

import { githubRepository, project } from '@altstack/db/schemas'

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
export const projectRouter = {
	getBySlug: getBySlugHandler,
	list: listHandler,
}
