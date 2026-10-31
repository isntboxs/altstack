import { eq } from 'drizzle-orm'

import { adminProcedure, publicProcedure } from '@altstack/api/procedures'
import {
	getAdminBlog,
	getPublicBlog,
	listAdminBlogs,
	listPublicBlogs,
} from '@altstack/api/queries/blog'
import { isUniqueViolation } from '@altstack/api/queries/pg-error'

import { blogPost } from '@altstack/db/schemas'

import { blogReadTime } from '@altstack/shared/schemas'

export const blogRouter = {
	list: publicProcedure.blog.list.handler(({ context: { db }, input }) =>
		listPublicBlogs(db, input.query.page, input.query.limit)
	),
	getBySlug: publicProcedure.blog.getBySlug.handler(
		async ({ context: { db }, input, errors }) => {
			const row = await getPublicBlog(db, input.params.slug)
			if (!row) throw errors.NOT_FOUND()
			return row
		}
	),
}
export const adminBlogRouter = {
	list: adminProcedure.admin.blog.list.handler(({ context: { db }, input }) =>
		listAdminBlogs(db, input.query.page, input.query.limit)
	),
	getById: adminProcedure.admin.blog.getById.handler(
		async ({ context: { db }, input, errors }) => {
			const row = await getAdminBlog(db, input.params.id)
			if (!row) throw errors.NOT_FOUND()
			return row
		}
	),
	create: adminProcedure.admin.blog.create.handler(
		async ({ context: { db, auth }, input, errors }) => {
			try {
				return await db.transaction(async (tx) => {
					const now = new Date()
					const [row] = await tx
						.insert(blogPost)
						.values({
							...input.body,
							authorId: auth.user.id,
							authorName: auth.user.name,
							readTime: blogReadTime(input.body.content),
							updatedAt: now,
							publishedAt: input.body.status === 'published' ? now : null,
						})
						.returning({ id: blogPost.id })
					if (!row) throw errors.INTERNAL_SERVER_ERROR()
					return (await getAdminBlog(tx, row.id))!
				})
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw errors.CONFLICT({
						message: 'This blog slug is already in use.',
					})
				}
				throw error
			}
		}
	),
	update: adminProcedure.admin.blog.update.handler(
		async ({ context: { db }, input, errors }) => {
			try {
				return await db.transaction(async (tx) => {
					const [current] = await tx
						.select()
						.from(blogPost)
						.where(eq(blogPost.id, input.params.id))
						.for('update')
					if (!current) throw errors.NOT_FOUND()
					if (current.version !== input.body.expectedVersion) {
						throw errors.CONFLICT({
							message: 'This blog changed. Reload before saving.',
						})
					}
					const { expectedVersion, ...body } = input.body
					const now = new Date()
					await tx
						.update(blogPost)
						.set({
							...body,
							readTime: blogReadTime(body.content),
							publishedAt:
								current.publishedAt ??
								(body.status === 'published' ? now : null),
							updatedAt: now,
							version: expectedVersion + 1,
						})
						.where(eq(blogPost.id, current.id))
					return (await getAdminBlog(tx, current.id))!
				})
			} catch (error) {
				if (isUniqueViolation(error)) {
					throw errors.CONFLICT({
						message: 'This blog slug is already in use.',
					})
				}
				throw error
			}
		}
	),
	delete: adminProcedure.admin.blog.delete.handler(
		async ({ context: { db }, input, errors }) =>
			db.transaction(async (tx) => {
				const [current] = await tx
					.select({ version: blogPost.version })
					.from(blogPost)
					.where(eq(blogPost.id, input.params.id))
					.for('update')
				if (!current) throw errors.NOT_FOUND()
				if (current.version !== input.body.expectedVersion) {
					throw errors.CONFLICT({
						message: 'This blog changed. Reload before deleting.',
					})
				}
				await tx.delete(blogPost).where(eq(blogPost.id, input.params.id))
				return { success: true as const }
			})
	),
}
