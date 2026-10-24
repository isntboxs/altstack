import { and, count, desc, eq } from 'drizzle-orm'

import { protectedProcedure } from '@altstack/api/procedures'
import { projectIsVerified } from '@altstack/api/queries/ownership'

import { bookmark, project } from '@altstack/db/schemas'

export const bookmarkRouter = {
	list: protectedProcedure.bookmark.list.handler(
		async ({ context: { db, auth }, input: { query } }) => {
			const visible = and(
				eq(bookmark.userId, auth.user.id),
				eq(project.status, 'published')
			)
			// Keep the count and page on one snapshot while bookmarks are changing.
			return db.transaction(
				async (tx) => {
					const bookmarks = await tx
						.select({
							id: project.id,
							name: project.name,
							verified: projectIsVerified,
							slug: project.slug,
							logo: project.logo,
							tagline: project.tagline,
						})
						.from(bookmark)
						.innerJoin(project, eq(bookmark.projectId, project.id))
						.where(visible)
						.orderBy(desc(bookmark.createdAt), desc(bookmark.projectId))
						.limit(query.limit)
						.offset((query.page - 1) * query.limit)
					const [total] = await tx
						.select({ count: count() })
						.from(bookmark)
						.innerJoin(project, eq(bookmark.projectId, project.id))
						.where(visible)
					const totalItems = total?.count ?? 0
					const totalPages = Math.ceil(totalItems / query.limit)
					return {
						bookmarks,
						pagination: {
							page: query.page,
							limit: query.limit,
							totalItems,
							totalPages,
							hasNextPage: query.page < totalPages,
							hasPreviousPage: query.page > 1,
						},
					}
				},
				{ isolationLevel: 'repeatable read', accessMode: 'read only' }
			)
		}
	),
	get: protectedProcedure.bookmark.get.handler(
		async ({ context: { db, auth }, input: { params }, errors }) => {
			const [row] = await db
				.select({ savedId: bookmark.projectId })
				.from(project)
				.leftJoin(
					bookmark,
					and(
						eq(bookmark.projectId, project.id),
						eq(bookmark.userId, auth.user.id)
					)
				)
				.where(and(eq(project.id, params.id), eq(project.status, 'published')))
				.limit(1)
			if (!row) throw errors.NOT_FOUND()
			return { bookmarked: row.savedId !== null }
		}
	),
	save: protectedProcedure.bookmark.save.handler(
		async ({ context: { db, auth }, input: { params }, errors }) =>
			db.transaction(async (tx) => {
				// SHARE also blocks concurrent status changes/deletion until the save
				// commits. Never accept a stale client claim that a project is public.
				const [visible] = await tx
					.select({ id: project.id })
					.from(project)
					.where(
						and(eq(project.id, params.id), eq(project.status, 'published'))
					)
					.limit(1)
					.for('share')
				if (!visible) throw errors.NOT_FOUND()
				await tx
					.insert(bookmark)
					.values({ userId: auth.user.id, projectId: visible.id })
					.onConflictDoNothing({
						target: [bookmark.userId, bookmark.projectId],
					})
				return { bookmarked: true }
			})
	),
	remove: protectedProcedure.bookmark.remove.handler(
		async ({ context: { db, auth }, input: { params } }) => {
			// Uniform response even if missing, foreign, deleted or unpublished.
			// This deletes no project and discloses no project existence/state.
			await db
				.delete(bookmark)
				.where(
					and(
						eq(bookmark.userId, auth.user.id),
						eq(bookmark.projectId, params.id)
					)
				)
			return { bookmarked: false }
		}
	),
}
