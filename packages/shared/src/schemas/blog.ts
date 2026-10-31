import { z } from 'zod'

export const blogSlugSchema = z
	.string()
	.trim()
	.min(1)
	.max(160)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
export const blogCoverSchema = z
	.url()
	.max(2000)
	.refine((value) => {
		if (!URL.canParse(value)) return false
		const url = new URL(value)
		return url.protocol === 'https:' && !url.username && !url.password
	}, 'Use an HTTPS image URL.')
export const blogBodySchema = z
	.object({
		title: z.string().trim().min(1).max(200),
		slug: blogSlugSchema,
		description: z.string().trim().min(1).max(500),
		coverUrl: blogCoverSchema,
		content: z.string().trim().min(1).max(200_000),
		status: z.enum(['draft', 'published']),
	})
	.strict()
export type BlogBody = z.infer<typeof blogBodySchema>

export const blogCardSchema = z.object({
	id: z.uuid(),
	title: z.string(),
	slug: z.string(),
	description: z.string(),
	coverUrl: z.string(),
	readTime: z.number().int().positive(),
	publishedAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
})
export const blogDetailSchema = blogCardSchema.extend({
	content: z.string(),
	authorName: z.string(),
	authorImage: z.string().nullable(),
})
export const adminBlogSchema = blogDetailSchema.extend({
	publishedAt: z.coerce.date().nullable(),
	status: z.enum(['draft', 'published']),
	version: z.number().int().positive(),
})
export const blogIdInput = z.object({ params: z.object({ id: z.uuid() }) })
export const blogRevisionInput = blogIdInput.extend({
	body: z.object({ expectedVersion: z.number().int().positive() }).strict(),
})

export function blogReadTime(content: string) {
	return Math.max(
		1,
		Math.ceil(content.trim().split(/\s+/u).filter(Boolean).length / 200)
	)
}
