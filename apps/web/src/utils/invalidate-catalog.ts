import type { QueryClient } from '@tanstack/react-query'

import { publicContentQueryKey } from '#/features/public-content/model'
import { adminORPC, categoryORPC, orpc, projectORPC } from '#/utils/orpc'

// Namespace keys omit inputs, so every page, search, detail and legacy category
// option query is refreshed. Also cover callers using the unprefixed root utils.
export async function invalidateCatalog(queryClient: QueryClient) {
	await Promise.all(
		[
			publicContentQueryKey,
			adminORPC.category.key(),
			categoryORPC.key(),
			adminORPC.project.key(),
			projectORPC.key(),
			orpc.admin.category.key(),
			orpc.category.key(),
			orpc.admin.project.key(),
			orpc.project.key(),
			orpc.submission.key(),
			orpc.tag.key(),
			orpc.license.key(),
			orpc.admin.tag.key(),
		].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
	)
}
