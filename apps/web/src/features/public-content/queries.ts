import { queryOptions } from '@tanstack/react-query'
import { log } from 'evlog/client'

import {
	emptyPublicContent,
	publicContentQueryKey,
} from '#/features/public-content/model'
import { preparePublicContent } from '#/features/public-content/server-function'

export function publicContentOptions(slug: string, content: string) {
	return queryOptions({
		queryKey: [...publicContentQueryKey, slug, content],
		queryFn: async () => {
			if (!content) return emptyPublicContent()
			try {
				return await preparePublicContent({ data: { slug } })
			} catch {
				// Enhancement failure must not hide the documentation. Do not log
				// source content (or a query key containing the entire document).
				log.warn({ action: 'public_content_prepare_failed', slug })
				return emptyPublicContent()
			}
		},
		staleTime: 30_000,
	})
}
