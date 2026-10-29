import { and, eq, inArray } from 'drizzle-orm'

import { adminProcedure, publicProcedure } from '@altstack/api/procedures'
import {
	getAdminCollection,
	getPublicCollection,
	listAdminCollections,
	listPublicCollections,
} from '@altstack/api/queries/collection'
import { isUniqueViolation } from '@altstack/api/queries/pg-error'

import {
	collection,
	collectionMember,
	githubRepository,
	project,
} from '@altstack/db/schemas'

export const collectionRouter = {
	list: publicProcedure.collection.list.handler(({ context: { db }, input }) =>
		listPublicCollections(db, input.query.page, input.query.limit)
	),
	getBySlug: publicProcedure.collection.getBySlug.handler(
		async ({ context: { db }, input, errors }) => {
			const result = await getPublicCollection(db, input.params.slug)
			if (!result) throw errors.NOT_FOUND()
			return result
		}
	),
}
export const adminCollectionRouter = {
	list: adminProcedure.admin.collection.list.handler(
		({ context: { db }, input }) =>
			listAdminCollections(db, input.query.page, input.query.limit)
	),
	getById: adminProcedure.admin.collection.getById.handler(
		async ({ context: { db }, input, errors }) => {
			const result = await getAdminCollection(db, input.params.id)
			if (!result) throw errors.NOT_FOUND()
			return result
		}
	),
	create: adminProcedure.admin.collection.create.handler(
		async ({ context: { db, auth }, input, errors }) => {
			try {
				return await db.transaction(async (tx) => {
					const { projectIds, ...body } = input.body
					const ids = [
						...projectIds,
						...(body.mainProjectId ? [body.mainProjectId] : []),
					].toSorted()
					const rows =
						ids.length > 0
							? await tx
									.select({ id: project.id })
									.from(project)
									.innerJoin(
										githubRepository,
										eq(githubRepository.projectId, project.id)
									)
									.where(
										and(
											inArray(project.id, ids),
											eq(project.status, 'published')
										)
									)
									.orderBy(project.id)
									.for('update', { of: project })
							: []
					if (rows.length !== ids.length) {
						throw errors.BAD_REQUEST({
							message:
								'Choose existing published projects. Remove unavailable projects before saving.',
						})
					}
					const [created] = await tx
						.insert(collection)
						.values({
							...body,
							authorId: auth.user.id,
							authorName: auth.user.name,
						})
						.returning({ id: collection.id })
					if (!created) throw errors.INTERNAL_SERVER_ERROR()
					if (projectIds.length > 0) {
						await tx.insert(collectionMember).values(
							projectIds.map((projectId, position) => {
								return {
									collectionId: created.id,
									projectId,
									position,
								}
							})
						)
					}
					return (await getAdminCollection(tx, created.id))!
				})
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw errors.CONFLICT({
						message: 'This collection slug is already in use.',
					})
				}
				throw error
			}
		}
	),
	update: adminProcedure.admin.collection.update.handler(
		async ({ context: { db }, input, errors }) => {
			try {
				return await db.transaction(async (tx) => {
					const [current] = await tx
						.select()
						.from(collection)
						.where(eq(collection.id, input.params.id))
						.for('update')
					if (!current) throw errors.NOT_FOUND()
					if (current.version !== input.body.expectedVersion) {
						throw errors.CONFLICT({
							message: 'This collection changed. Reload before saving.',
						})
					}
					const { projectIds, expectedVersion, ...body } = input.body
					const ids = [
						...projectIds,
						...(body.mainProjectId ? [body.mainProjectId] : []),
					].toSorted()
					const rows =
						ids.length > 0
							? await tx
									.select({ id: project.id })
									.from(project)
									.innerJoin(
										githubRepository,
										eq(githubRepository.projectId, project.id)
									)
									.where(
										and(
											inArray(project.id, ids),
											eq(project.status, 'published')
										)
									)
									.orderBy(project.id)
									.for('update', { of: project })
							: []
					if (rows.length !== ids.length) {
						throw errors.BAD_REQUEST({
							message:
								'Choose existing published projects. Remove unavailable projects before saving.',
						})
					}
					await tx
						.update(collection)
						.set({
							...body,
							updatedAt: new Date(),
							version: expectedVersion + 1,
						})
						.where(eq(collection.id, current.id))
					await tx
						.delete(collectionMember)
						.where(eq(collectionMember.collectionId, current.id))
					if (projectIds.length > 0) {
						await tx.insert(collectionMember).values(
							projectIds.map((projectId, position) => {
								return {
									collectionId: current.id,
									projectId,
									position,
								}
							})
						)
					}
					return (await getAdminCollection(tx, current.id))!
				})
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw errors.CONFLICT({
						message: 'This collection slug is already in use.',
					})
				}
				throw error
			}
		}
	),
	delete: adminProcedure.admin.collection.delete.handler(
		async ({ context: { db }, input, errors }) =>
			db.transaction(async (tx) => {
				const [current] = await tx
					.select({ version: collection.version })
					.from(collection)
					.where(eq(collection.id, input.params.id))
					.for('update')
				if (!current) throw errors.NOT_FOUND()
				if (current.version !== input.body.expectedVersion) {
					throw errors.CONFLICT({
						message: 'This collection changed. Reload before deleting.',
					})
				}
				await tx.delete(collection).where(eq(collection.id, input.params.id))
				return { success: true as const }
			})
	),
}
