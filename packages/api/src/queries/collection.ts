import { and, asc, count, desc, eq, getTableColumns, sql } from 'drizzle-orm'

import type { db } from '@altstack/db'
import {
	collection,
	collectionMember,
	githubRepository,
	project,
} from '@altstack/db/schemas'

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
export async function listPublicCollections(
	database: CollectionDatabase,
	page = 1,
	limit = 12
) {
	const [collections, totals] = await Promise.all([
		database
			.select(cardFields)
			.from(collection)
			.where(visibleCollection)
			.orderBy(desc(collection.updatedAt), asc(collection.id))
			.limit(limit)
			.offset((page - 1) * limit),
		database
			.select({ total: count() })
			.from(collection)
			.where(visibleCollection),
	])
	return { collections, total: totals[0]?.total ?? 0 }
}
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
		})
		.from(collection)
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
export async function sitemapCollections(database: CollectionDatabase) {
	return database
		.select({ slug: collection.slug, updatedAt: collection.updatedAt })
		.from(collection)
		.where(visibleCollection)
		.orderBy(asc(collection.id))
}
