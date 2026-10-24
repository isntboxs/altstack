import { z } from 'zod'

import { paginationSchema } from '@altstack/shared/schemas/common'

// Account identity is always supplied by the session, never by request input.
export const bookmarkProjectInputSchema = z.object({
	params: z.object({ id: z.uuid() }).strict(),
})

export const bookmarkStateSchema = z.object({ bookmarked: z.boolean() })

export const listBookmarkQuerySchema = z
	.object({
		page: z.coerce.number().int().min(1).max(1_000_000).optional().default(1),
		limit: z.coerce.number().int().min(1).max(50).optional().default(25),
	})
	.strict()

export const listBookmarkInputSchema = z.object({
	query: listBookmarkQuerySchema,
})

export const bookmarkListItemSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	verified: z.boolean().default(false),
	slug: z.string(),
	logo: z.string().nullable(),
	tagline: z.string().nullable(),
})

export const listBookmarkOutputSchema = z.object({
	bookmarks: z.array(bookmarkListItemSchema),
	pagination: paginationSchema,
})
