import { openapi } from '@orpc/openapi'
import { z } from 'zod'

import { baseContract, publicContract } from '@altstack/api/contracts/base'

import {
	adminBlogSchema,
	blogBodySchema,
	blogCardSchema,
	blogDetailSchema,
	blogIdInput,
	blogRevisionInput,
	blogSlugSchema,
} from '@altstack/shared/schemas'

const page = z.object({
	query: z.object({
		page: z.coerce.number().int().min(1).max(100000).default(1),
		limit: z.coerce.number().int().min(1).max(50).default(12),
	}),
})
function meta(
	path: `/${string}`,
	method: 'QUERY' | 'POST' | 'PUT' | 'DELETE',
	operationId: string
) {
	return openapi({
		path,
		method,
		inputStructure: 'detailed',
		outputStructure: 'compact',
		operationId,
		tags: ['Blogs'],
	})
}
export const blogContract = {
	list: publicContract
		.meta(meta('/blogs', 'QUERY', 'listBlogs'))
		.input(page)
		.output(
			z.object({ posts: z.array(blogCardSchema), total: z.number().int() })
		),
	getBySlug: publicContract
		.meta(meta('/blogs/{slug}', 'QUERY', 'getBlog'))
		.input(z.object({ params: z.object({ slug: blogSlugSchema }) }))
		.output(blogDetailSchema),
}
export const adminBlogContract = {
	list: baseContract
		.meta(meta('/admin/blogs', 'QUERY', 'listAdminBlogs'))
		.input(page)
		.output(
			z.object({
				posts: z.array(adminBlogSchema.omit({ content: true })),
				total: z.number().int(),
			})
		),
	getById: baseContract
		.meta(meta('/admin/blogs/{id}', 'QUERY', 'getAdminBlog'))
		.input(blogIdInput)
		.output(adminBlogSchema),
	create: baseContract
		.meta(meta('/admin/blogs', 'POST', 'createBlog'))
		.input(z.object({ body: blogBodySchema }))
		.output(adminBlogSchema),
	update: baseContract
		.meta(meta('/admin/blogs/{id}', 'PUT', 'updateBlog'))
		.input(
			blogRevisionInput.extend({
				body: blogBodySchema.extend({
					expectedVersion: z.number().int().positive(),
				}),
			})
		)
		.output(adminBlogSchema),
	delete: baseContract
		.meta(meta('/admin/blogs/{id}', 'DELETE', 'deleteBlog'))
		.input(blogRevisionInput)
		.output(z.object({ success: z.literal(true) })),
}
