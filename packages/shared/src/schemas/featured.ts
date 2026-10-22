import { z } from 'zod'

import { PROJECT_STATUS } from '@altstack/shared/constants'

export const MAX_FEATURED_PROJECTS = 21

export function featuredWebsiteUrl(value: string | null | undefined) {
	if (!value) return null
	try {
		const url = new URL(value)
		return /^https?:$/.test(url.protocol) && !url.username && !url.password
			? url.href
			: null
	} catch {
		return null
	}
}

export const featuredProjectPreviewSchema = z.object({
	id: z.uuid(),
	slug: z.string(),
	name: z.string(),
	logo: z.string().nullable(),
	tagline: z.string().nullable(),
	websiteUrl: z.url({ protocol: /^https?$/ }),
	stars: z.number().int().nonnegative(),
	forks: z.number().int().nonnegative(),
})

export const adminFeaturedListOutputSchema = z.object({
	projects: z
		.array(
			z.object({
				id: z.uuid(),
				name: z.string(),
				slug: z.string(),
				logo: z.string().nullable(),
				tagline: z.string().nullable(),
				websiteUrl: z.string().nullable(),
				status: z.enum(PROJECT_STATUS),
			})
		)
		.max(MAX_FEATURED_PROJECTS),
})

const orderedIds = z
	.array(z.uuid())
	.max(MAX_FEATURED_PROJECTS)
	.refine(
		(ids) => new Set(ids).size === ids.length,
		'Each project can only be featured once.'
	)

export const adminFeaturedUpdateInputSchema = z.object({
	body: z.object({
		projectIds: orderedIds,
		expectedProjectIds: orderedIds,
	}),
})
