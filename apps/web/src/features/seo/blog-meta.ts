import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { resolveFileUrl } from '#/utils/storage'
import { blogImage, publicUrl, seoHead } from './meta'

export function blogHead(post: ORPCRouterOutputs['blog']['getBySlug']) {
	return seoHead({
		type: 'article',
		title: `${post.title} | AltStack`,
		description: post.description,
		path: `/blogs/${post.slug}`,
		image: blogImage(post.id, post.updatedAt),
		imageAlt: post.title,
		entities: [
			{
				'@type': 'BlogPosting',
				headline: post.title,
				description: post.description,
				image: resolveFileUrl(post.coverUrl),
				url: publicUrl(`/blogs/${post.slug}`),
				datePublished: post.publishedAt.toISOString(),
				dateModified: post.updatedAt.toISOString(),
				author: { '@type': 'Person', name: post.authorName },
				publisher: { '@id': publicUrl('/#organization') },
			},
		],
	})
}
