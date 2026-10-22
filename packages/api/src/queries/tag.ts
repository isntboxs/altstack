import { and, asc, count, desc, eq, ilike, sql } from 'drizzle-orm'
import type { z } from 'zod'

import type { db } from '@altstack/db'
import {
	githubRepository,
	project,
	projectTag,
	tag,
} from '@altstack/db/schemas'

import type { tagListQuerySchema } from '@altstack/shared/schemas/tag'

type TagDatabase = Pick<typeof db, 'select'>
export const publicTagProjectCount =
	sql<number>`(SELECT count(*)::int FROM ${projectTag}
 INNER JOIN ${project} ON ${project.id} = ${projectTag.projectId}
 INNER JOIN ${githubRepository} ON ${githubRepository.projectId} = ${project.id}
 WHERE ${projectTag.tagId} = ${tag.id} AND ${project.status} = 'published')`.mapWith(
		Number
	)
const assignmentCount =
	sql<number>`(SELECT count(*)::int FROM ${projectTag} WHERE ${projectTag.tagId} = ${tag.id})`.mapWith(
		Number
	)
export const publicTagFields = {
	id: tag.id,
	slug: tag.slug,
	name: tag.name,
	description: tag.description,
}
const publicTagWhere = and(
	eq(tag.hidden, false),
	sql`${publicTagProjectCount} > 0`
)

export async function listTags(
	database: TagDatabase,
	query: z.infer<typeof tagListQuerySchema>,
	admin = false
) {
	const conditions = admin ? [] : [publicTagWhere]
	if (query.q) {
		const pattern = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`
		conditions.push(ilike(tag.name, pattern))
	}
	if (query.letter) {
		conditions.push(
			query.letter === '&'
				? sql`${tag.name} !~* '^[a-z]'`
				: ilike(tag.name, `${query.letter}%`)
		)
	}
	const where = and(...conditions)
	const order =
		query.sort === 'popular'
			? [desc(publicTagProjectCount), asc(sql`lower(${tag.name})`), asc(tag.id)]
			: [
					query.sort === 'name-desc'
						? desc(sql`lower(${tag.name})`)
						: asc(sql`lower(${tag.name})`),
					asc(tag.id),
				]
	const rows = await database
		.select({
			...publicTagFields,
			projectCount: publicTagProjectCount,
			hidden: tag.hidden,
			assignmentCount,
		})
		.from(tag)
		.where(where)
		.orderBy(...order)
		.limit(query.limit)
		.offset((query.page - 1) * query.limit)
	const [total] = await database
		.select({ total: count() })
		.from(tag)
		.where(where)
	const totalItems = total?.total ?? 0
	const totalPages = Math.ceil(totalItems / query.limit)
	return {
		tags: rows,
		pagination: {
			page: query.page,
			limit: query.limit,
			totalItems,
			totalPages,
			hasNextPage: query.page < totalPages,
			hasPreviousPage: query.page > 1,
		},
	}
}

export async function getPublicTag(database: TagDatabase, slug: string) {
	const [row] = await database
		.select({ ...publicTagFields, projectCount: publicTagProjectCount })
		.from(tag)
		.where(and(eq(tag.slug, slug), publicTagWhere))
		.limit(1)
	return row
}

export function projectHasPublicTag(slug: string) {
	return sql`EXISTS (SELECT 1 FROM ${projectTag} INNER JOIN ${tag} ON ${tag.id} = ${projectTag.tagId}
 WHERE ${projectTag.projectId} = ${project.id} AND ${tag.slug} = ${slug} AND ${tag.hidden} = false)`
}

export function getProjectTags(database: TagDatabase, projectId: string) {
	return database
		.select(publicTagFields)
		.from(projectTag)
		.innerJoin(tag, eq(tag.id, projectTag.tagId))
		.where(and(eq(projectTag.projectId, projectId), eq(tag.hidden, false)))
		.orderBy(asc(tag.name), asc(tag.id))
}
