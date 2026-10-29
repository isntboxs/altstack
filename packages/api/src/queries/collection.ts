import { and, asc, count, desc, eq, getTableColumns, sql } from 'drizzle-orm'

import type { db } from '@altstack/db'
import {
	collection,
	collectionMember,
	githubRepository,
	project,
	user,
} from '@altstack/db/schemas'

import { sourceRepositorySchema } from '@altstack/shared/schemas/collection'

export type CollectionDatabase = Pick<typeof db, 'select'>
// One shared live policy for public list, detail, and sitemap. No draft or
// unavailable target can leak through a different discovery surface.
export const visibleCollection = sql` ${collection.status} = 'published'
 AND (${collection.kind} = 'repository' OR EXISTS (
 SELECT 1 FROM projects target JOIN github_repositories target_repo ON target_repo.project_id = target.id
 WHERE target.id = ${collection.mainProjectId} AND target.status = 'published'))
 AND EXISTS (SELECT 1 FROM collection_members cm JOIN projects member ON member.id = cm.project_id
 JOIN github_repositories member_repo ON member_repo.project_id = member.id
 WHERE cm.collection_id = "collections"."id" AND member.status = 'published')`
export const collectionProjectFields = {
	id: project.id,
	name: project.name,
	slug: project.slug,
	description: project.description,
	logo: project.logo,
	screenshot: project.screenshot,
	content: project.content,
	websiteUrl: project.websiteUrl,
	repositoryUrl: project.repositoryUrl,
}
const cardFields = {
	id: collection.id,
	name: collection.name,
	slug: collection.slug,
	description: collection.description,
	kind: collection.kind,
	updatedAt: collection.updatedAt,
	// Keep the outer ID qualified: Drizzle may unqualify SELECT expressions,
	// which would otherwise bind id to a project inside the correlated query.
	memberCount: sql<number>`(SELECT count(*)::integer FROM collection_members cm JOIN projects member ON member.id = cm.project_id JOIN github_repositories repo ON repo.project_id = member.id WHERE cm.collection_id = "collections"."id" AND member.status = 'published')`,
}
/** Resolves source-owner artwork only for a validated public GitHub repository. */
function repositoryAvatar(source: string | null) {
	const parsed = sourceRepositorySchema.safeParse(source)
	if (!parsed.success) return null
	const owner = new URL(parsed.data).pathname.split('/')[1]
	return owner ? `https://github.com/${owner}.png?size=256` : null
}
/** Paginates eligible collections with current artwork and visible-member counts. */
export async function listPublicCollections(
	database: CollectionDatabase,
	page = 1,
	limit = 12
) {
	const [collections, totals] = await Promise.all([
		database
			.select({
				...cardFields,
				mainProjectLogo: project.logo,
				sourceRepositoryUrl: collection.sourceRepositoryUrl,
			})
			.from(collection)
			.leftJoin(
				project,
				and(
					eq(project.id, collection.mainProjectId),
					eq(project.status, 'published')
				)
			)
			.where(visibleCollection)
			.orderBy(desc(collection.updatedAt), asc(collection.id))
			.limit(limit)
			.offset((page - 1) * limit),
		database
			.select({ total: count() })
			.from(collection)
			.where(visibleCollection),
	])
	return {
		collections: collections.map(
			({ mainProjectLogo, sourceRepositoryUrl, ...entry }) => {
				return {
					...entry,
					logo:
						entry.kind === 'repository'
							? repositoryAvatar(sourceRepositoryUrl)
							: mainProjectLogo,
				}
			}
		),
		total: totals[0]?.total ?? 0,
	}
}
/** Loads current published members and rejects an unavailable target or empty list. */
export async function getPublicCollection(
	database: CollectionDatabase,
	slug: string
) {
	const [row] = await database
		.select({
			...cardFields,
			content: collection.content,
			sourceRepositoryUrl: collection.sourceRepositoryUrl,
			mainProjectId: collection.mainProjectId,
			authorName: collection.authorName,
			authorImage: user.image,
		})
		.from(collection)
		.leftJoin(user, eq(user.id, collection.authorId))
		.where(and(visibleCollection, eq(collection.slug, slug)))
		.limit(1)
	if (!row) return undefined
	const projects = await database
		.select(collectionProjectFields)
		.from(collectionMember)
		.innerJoin(project, eq(project.id, collectionMember.projectId))
		.innerJoin(githubRepository, eq(githubRepository.projectId, project.id))
		.where(
			and(
				eq(collectionMember.collectionId, row.id),
				eq(project.status, 'published')
			)
		)
		.orderBy(asc(collectionMember.position))
	const [mainProject] = row.mainProjectId
		? await database
				.select(collectionProjectFields)
				.from(project)
				.innerJoin(githubRepository, eq(githubRepository.projectId, project.id))
				.where(
					and(
						eq(project.id, row.mainProjectId),
						eq(project.status, 'published')
					)
				)
				.limit(1)
		: []
	if (projects.length === 0 || (row.kind !== 'repository' && !mainProject)) {
		return undefined
	}
	const { mainProjectId, ...publicRow } = row
	void mainProjectId
	return {
		...publicRow,
		memberCount: projects.length,
		mainProject: mainProject ?? null,
		projects,
	}
}
/** Includes unavailable selected projects so editors can repair draft membership. */
export async function getAdminCollection(
	database: CollectionDatabase,
	id: string
) {
	const [row] = await database
		.select()
		.from(collection)
		.where(eq(collection.id, id))
		.limit(1)
	if (!row) return undefined
	const projects = await database
		.select({ ...collectionProjectFields, status: project.status })
		.from(collectionMember)
		.innerJoin(project, eq(project.id, collectionMember.projectId))
		.where(eq(collectionMember.collectionId, id))
		.orderBy(asc(collectionMember.position))
	const [mainProject] = row.mainProjectId
		? await database
				.select({ ...collectionProjectFields, status: project.status })
				.from(project)
				.where(eq(project.id, row.mainProjectId))
				.limit(1)
		: []
	return { ...row, projects, mainProject: mainProject ?? null }
}
/** Lists editorial records and revisions without applying public visibility rules. */
export async function listAdminCollections(
	database: CollectionDatabase,
	page: number,
	limit: number
) {
	const { authorId, createdAt, ...fields } = getTableColumns(collection)
	void authorId
	void createdAt
	const [collections, totals] = await Promise.all([
		database
			.select(fields)
			.from(collection)
			.orderBy(desc(collection.updatedAt), asc(collection.id))
			.limit(limit)
			.offset((page - 1) * limit),
		database.select({ total: count() }).from(collection),
	])
	return { collections, total: totals[0]?.total ?? 0 }
}
/** Uses the directory's live eligibility policy for collection sitemap entries. */
export async function sitemapCollections(database: CollectionDatabase) {
	return database
		.select({ slug: collection.slug, updatedAt: collection.updatedAt })
		.from(collection)
		.where(visibleCollection)
		.orderBy(asc(collection.id))
}
