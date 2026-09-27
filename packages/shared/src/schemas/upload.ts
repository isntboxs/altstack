import 'zod/compile'
import { z } from 'zod'

import { LOGO_MAX_SIZE, LOGO_MIME } from '@altstack/shared/constants'

export const logoKeySchema = z
	.string()
	.regex(
		/^projects\/logos\/[a-z0-9-]+-[0-9]+\.(png|jpe?g|webp|gif)$/,
		'Invalid logo key'
	)

export const requestLogoUploadInputSchema = z.object({
	filename: z.string().trim().min(1).max(100),
	contentType: z.enum(LOGO_MIME),
	size: z.number().int().min(1).max(LOGO_MAX_SIZE),
})

export const requestLogoUploadOutputSchema = z.object({
	key: logoKeySchema,
	presignedUrl: z.url(),
	publicUrl: z.url(),
})

export const removeLogoUploadInputSchema = z.object({
	key: logoKeySchema,
})

export const removeLogoUploadOutputSchema = z.object({
	success: z.literal(true),
})
