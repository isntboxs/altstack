import { count, desc, eq, inArray } from 'drizzle-orm'

import { adminProcedure } from '@altstack/api/procedures'

import {
	category,
	githubRepository,
	project,
	projectCategory,
} from '@altstack/db/schemas'

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

			db.select({ total: count() }).from(project).where(where),
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

export const adminProjectRouter = {
	list: adminListProjectHandler,
}
