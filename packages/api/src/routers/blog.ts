import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { adminProcedure, publicProcedure } from '@altstack/api/procedures'
import {
	getAdminBlog,
	getPublicBlog,
	listAdminBlogs,
	listPublicBlogs,
} from '@altstack/api/queries/blog'
import { isUniqueViolation } from '@altstack/api/queries/pg-error'
import {
	promoteTempImageToBlogCover,
	deleteFinalKeysBestEffort,
	TempUploadMissingError,
	InvalidTempUploadError,
} from '@altstack/api/storage'

import { blogPost } from '@altstack/db/schemas'

import { blogReadTime, blogCoverKeySchema } from '@altstack/shared/schemas'
import { screenshotKeySchema } from '@altstack/shared/schemas/upload'

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
			const id = randomUUID()
			const uploaded = screenshotKeySchema.safeParse(
				input.body.coverUrl
			).success
			let promoted: string | undefined
			try {
				if (blogCoverKeySchema.safeParse(input.body.coverUrl).success) {
					throw errors.BAD_REQUEST({
						message: 'Upload a new cover or use an HTTPS image URL.',
					})
				}
				if (uploaded) {
					promoted = await promoteTempImageToBlogCover({
						tmpKey: input.body.coverUrl,
						postId: id,
					})
				}
				const result = await db.transaction(async (tx) => {
					const now = new Date()
					const [row] = await tx
						.insert(blogPost)
						.values({
							...input.body,
							id,
							coverUrl: promoted ?? input.body.coverUrl,
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
				if (uploaded) await deleteFinalKeysBestEffort([input.body.coverUrl])
				return result
			} catch (error) {
				if (promoted) await deleteFinalKeysBestEffort([promoted])
				if (
					error instanceof TempUploadMissingError ||
					error instanceof InvalidTempUploadError
				) {
					throw errors.UPLOAD_EXPIRED()
				}
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
			let promoted: string | undefined
			let stale: string | undefined
			const uploaded = screenshotKeySchema.safeParse(
				input.body.coverUrl
			).success
			try {
				const result = await db.transaction(async (tx) => {
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
					if (
						blogCoverKeySchema.safeParse(input.body.coverUrl).success &&
						input.body.coverUrl !== current.coverUrl
					) {
						throw errors.BAD_REQUEST({
							message:
								'This cover belongs to another post. Upload a new image.',
						})
					}
					if (uploaded) {
						promoted = await promoteTempImageToBlogCover({
							tmpKey: input.body.coverUrl,
							postId: current.id,
						})
					}
					if (
						current.coverUrl !== input.body.coverUrl &&
						blogCoverKeySchema.safeParse(current.coverUrl).success &&
						current.coverUrl.startsWith(`blogs/${current.id}/`)
					) {
						stale = current.coverUrl
					}
					const { expectedVersion, ...body } = input.body
					const now = new Date()
					await tx
						.update(blogPost)
						.set({
							...body,
							coverUrl: promoted ?? body.coverUrl,
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
				await deleteFinalKeysBestEffort([
					...(uploaded ? [input.body.coverUrl] : []),
					...(stale ? [stale] : []),
				])
				return result
			} catch (error) {
				if (promoted) await deleteFinalKeysBestEffort([promoted])
				if (
					error instanceof TempUploadMissingError ||
					error instanceof InvalidTempUploadError
				) {
					throw errors.UPLOAD_EXPIRED()
				}
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
		async ({ context: { db }, input, errors }) => {
			const cover = await db.transaction(async (tx) => {
				const [current] = await tx
					.select({ version: blogPost.version, coverUrl: blogPost.coverUrl })
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
				return current.coverUrl
			})
			if (
				blogCoverKeySchema.safeParse(cover).success &&
				cover.startsWith(`blogs/${input.params.id}/`)
			) {
				await deleteFinalKeysBestEffort([cover])
			}
			return { success: true as const }
		}
	),
}
