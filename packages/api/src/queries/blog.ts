import { and, count, desc, eq, getTableColumns, isNotNull } from 'drizzle-orm'

import type { db } from '@altstack/db'
import { blogPost, user } from '@altstack/db/schemas'

type BlogDatabase = Pick<typeof db, 'select'>
export const visibleBlog = and(
	eq(blogPost.status, 'published'),
	isNotNull(blogPost.publishedAt)
)
const cardFields = {
	id: blogPost.id,
	title: blogPost.title,
	slug: blogPost.slug,
	description: blogPost.description,
	coverUrl: blogPost.coverUrl,
	readTime: blogPost.readTime,
	publishedAt: blogPost.publishedAt,
	updatedAt: blogPost.updatedAt,
}
export async function listPublicBlogs(
	database: BlogDatabase,
	page: number,
	limit: number
) {
	const [rows, totals] = await Promise.all([
		database
			.select(cardFields)
			.from(blogPost)
			.where(visibleBlog)
			.orderBy(desc(blogPost.publishedAt), desc(blogPost.id))
			.limit(limit)
			.offset((page - 1) * limit),
		database.select({ total: count() }).from(blogPost).where(visibleBlog),
	])
	return {
		posts: rows.map((row) => {
			return { ...row, publishedAt: row.publishedAt! }
		}),
		total: totals[0]?.total ?? 0,
	}
}
export async function getPublicBlog(database: BlogDatabase, slug: string) {
	const [row] = await database
		.select({
			...cardFields,
			content: blogPost.content,
			authorName: blogPost.authorName,
			authorImage: user.image,
		})
		.from(blogPost)
		.leftJoin(user, eq(blogPost.authorId, user.id))
		.where(and(visibleBlog, eq(blogPost.slug, slug)))
	return row ? { ...row, publishedAt: row.publishedAt! } : null
}
export async function getAdminBlog(database: BlogDatabase, id: string) {
	const [row] = await database
		.select({ ...getTableColumns(blogPost), authorImage: user.image })
		.from(blogPost)
		.leftJoin(user, eq(blogPost.authorId, user.id))
		.where(eq(blogPost.id, id))
	return row ?? null
}
export async function listAdminBlogs(
	database: BlogDatabase,
	page: number,
	limit: number
) {
	const [posts, totals] = await Promise.all([
		database
			.select({
				...cardFields,
				status: blogPost.status,
				version: blogPost.version,
				authorName: blogPost.authorName,
				authorImage: user.image,
			})
			.from(blogPost)
			.leftJoin(user, eq(blogPost.authorId, user.id))
			.orderBy(desc(blogPost.updatedAt), desc(blogPost.id))
			.limit(limit)
			.offset((page - 1) * limit),
		database.select({ total: count() }).from(blogPost),
	])
	return { posts, total: totals[0]?.total ?? 0 }
}
export function sitemapBlogs(database: BlogDatabase) {
	return database
		.select({ slug: blogPost.slug, updatedAt: blogPost.updatedAt })
		.from(blogPost)
		.where(visibleBlog)
		.orderBy(blogPost.slug)
}
