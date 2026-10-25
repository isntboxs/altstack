import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	getTableColumns,
	inArray,
	lte,
	ne,
	sql,
} from 'drizzle-orm'

import { githubDetail } from '@altstack/api/github-refresh'
import { publicProcedure } from '@altstack/api/procedures'
import {
	getDirectProjectCategories,
	listPublicCategories,
	projectInCategorySubtree,
} from '@altstack/api/queries/category'
import { buildGithubStarsHistory } from '@altstack/api/queries/github-stars'
import { projectHasLicense } from '@altstack/api/queries/license'
import { projectIsVerified } from '@altstack/api/queries/ownership'
import { searchPublicProjectMentions } from '@altstack/api/queries/project-mentions'
import { getProjectTags, projectHasPublicTag } from '@altstack/api/queries/tag'

import {
	category,
	featuredProject,
	githubRepository,
	githubStarHistory,
	project,
	projectCategory,
} from '@altstack/db/schemas'

import {
	githubSnapshotDate,
	githubStarsWindow,
} from '@altstack/shared/lib/github-stars'
import { projectSchema } from '@altstack/shared/schemas/common'
import { featuredWebsiteUrl } from '@altstack/shared/schemas/featured'

const publicFields = projectSchema.omit({ categories: true })

const getBySlugHandler = publicProcedure.project.getBySlug.handler(
	async ({ context, errors, input }) => {
		const { db } = context
		const window = githubStarsWindow(new Date())
		return db.transaction(
			async (tx) => {
				const [row] = await tx
					.select({
						projects: getTableColumns(project),
						github_repositories: getTableColumns(githubRepository),
						verified: projectIsVerified,
					})
					.from(project)
					.where(
						and(
							eq(project.slug, input.params.slug),
							eq(project.status, 'published')
						)
					)
					.innerJoin(
						githubRepository,
						eq(project.id, githubRepository.projectId)
					)
					.limit(1)

				if (!row) {
					throw errors.NOT_FOUND()
				}
				const featuredRows = await tx
					.select({
						id: project.id,
						slug: project.slug,
						name: project.name,
						verified: projectIsVerified,
						logo: project.logo,
						tagline: project.tagline,
						websiteUrl: project.websiteUrl,
						stars: githubRepository.stars,
						forks: githubRepository.forks,
					})
					.from(featuredProject)
					.innerJoin(project, eq(project.id, featuredProject.projectId))
					.innerJoin(
						githubRepository,
						eq(githubRepository.projectId, project.id)
					)
					.where(
						and(
							eq(project.status, 'published'),
							ne(project.id, row.projects.id)
						)
					)
					.orderBy(asc(featuredProject.position))
					.limit(21)
				const featuredProjects = featuredRows.flatMap((item) => {
					const websiteUrl = featuredWebsiteUrl(item.websiteUrl)
					return websiteUrl ? [{ ...item, websiteUrl }] : []
				})
				const points = await tx
					.select({
						date: githubStarHistory.snapshotDate,
						stars: githubStarHistory.stars,
						observedAt: githubStarHistory.observedAt,
					})
					.from(githubStarHistory)
					.where(
						and(
							eq(githubStarHistory.projectId, row.projects.id),
							gte(githubStarHistory.snapshotDate, window.windowStartDate),
							lte(githubStarHistory.snapshotDate, window.windowEndDate)
						)
					)
					.orderBy(asc(githubStarHistory.snapshotDate))

				return {
					...publicFields.parse({ ...row.projects, verified: row.verified }),
					featuredProjects,
					tags: await getProjectTags(tx, row.projects.id),
					categoryDetails: await getDirectProjectCategories(
						tx,
						row.projects.id
					),
					screenshot: row.projects.screenshot,
					github: githubDetail(row.github_repositories),
					githubStarsHistory: buildGithubStarsHistory(window, points),
				}
			},
			{ isolationLevel: 'repeatable read', accessMode: 'read only' }
		)
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
				.select({
					projects: getTableColumns(project),
					github_repositories: getTableColumns(githubRepository),
					verified: projectIsVerified,
				})
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
					...publicFields.parse({ ...row.projects, verified: row.verified }),
					screenshot: row.projects.screenshot,
					github: githubDetail(row.github_repositories),
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
function searchSortOrder(now: Date) {
	const end = githubSnapshotDate(now)
	const start = githubSnapshotDate(new Date(now.getTime() - 7 * 86400000))
	// Compare actual first/last daily observations in the trailing seven-day
	// window. No extrapolation, stars fallback, or inference from one point.
	const trending = sql<number | null>`(
		select (array_agg(h.stars order by h.snapshot_date desc))[1]
			- (array_agg(h.stars order by h.snapshot_date asc))[1]
		from ${githubStarHistory} h
		where h.project_id = ${project.id}
			and h.snapshot_date >= ${start}::date and h.snapshot_date <= ${end}::date
		having count(*) >= 2
	)`
	return {
		recommended: [
			desc(projectIsVerified),
			desc(githubRepository.stars),
			desc(project.id),
		],
		newest: [desc(project.createdAt), desc(project.id)],
		oldest: [asc(project.createdAt), asc(project.id)],
		name: [asc(project.name), asc(project.id)],
		'most-stars': [desc(githubRepository.stars), desc(project.id)],
		'most-forks': [desc(githubRepository.forks), desc(project.id)],
		'most-popular': [desc(githubRepository.stars), desc(project.id)],
		'name-desc': [desc(project.name), desc(project.id)],
		'last-commit': [
			sql`${githubRepository.lastCommitAt} desc nulls last`,
			desc(project.id),
		],
		'repository-age': [
			sql`${githubRepository.repositoryCreatedAt} asc nulls last`,
			asc(project.id),
		],
		trending: [sql`${trending} desc nulls last`, desc(project.id)],
	} as const
}

const searchHandler = publicProcedure.project.search.handler(
	async ({ context, input }) => {
		const { db } = context

		const page = input.query.page
		const limit = input.query.limit
		const offset = (page - 1) * limit

		// Visibility is decided here, never in the UI: every branch stays
		// limited to published projects.
		const conditions = [eq(project.status, 'published')]

		if (input.query.license) {
			conditions.push(projectHasLicense(input.query.license))
		}

		if (input.query.tag) conditions.push(projectHasPublicTag(input.query.tag))

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
				.select({
					projects: getTableColumns(project),
					github_repositories: getTableColumns(githubRepository),
					verified: projectIsVerified,
				})
				.from(project)
				.where(where)
				.innerJoin(githubRepository, eq(project.id, githubRepository.projectId))
				.orderBy(...searchSortOrder(new Date())[input.query.sort])
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
			asOf: new Date(),
			projects: rows.map((row) => {
				return {
					...publicFields.parse({ ...row.projects, verified: row.verified }),
					github: githubDetail(row.github_repositories),
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
	mentions: publicProcedure.project.mentions.handler(
		async ({ context, input }) => {
			return {
				projects: await searchPublicProjectMentions(input.query.q, context.db),
			}
		}
	),
	listCategories: listCategoriesHandler,
}
