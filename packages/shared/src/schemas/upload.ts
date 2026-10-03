import 'zod/compile'
import { z } from 'zod'

import {
	LOGO_MAX_SIZE,
	LOGO_MIME,
	SCREENSHOT_MAX_SIZE,
	SCREENSHOT_MIME,
} from '@altstack/shared/constants'

export const logoKeySchema = z
	.string()
	.regex(
		/^tmp\/logos\/[a-z0-9-]+-[0-9]+\.(png|jpe?g|webp|gif)$/,
		'Invalid logo key'
	)

// Final keys stored in DB after promote on project submit:
// projects/{slug}/logo-{uuid}.ext
export const projectLogoKeySchema = z
	.string()
	.regex(
		/^projects\/[a-z0-9]+(?:-[a-z0-9]+)*\/logo-[0-9a-f-]{36}\.(png|jpe?g|webp|gif)$/,
		'Invalid project logo key'
	)

export const requestLogoUploadInputSchema = z.object({
	filename: z.string().trim().min(1).max(100),
	contentType: z.enum(LOGO_MIME),
	size: z.number().int().min(1).max(LOGO_MAX_SIZE),
})

export const requestLogoUploadOutputSchema = z.object({
	key: logoKeySchema,
	presignedUrl: z.url(),
})

export const removeLogoUploadInputSchema = z.object({
	key: logoKeySchema,
})

export const removeLogoUploadOutputSchema = z.object({
	success: z.literal(true),
})

export const changeLogoUploadInputSchema = z.object({
	oldKey: logoKeySchema,
	newKey: logoKeySchema,
})

export const changeLogoUploadOutputSchema = z.object({
	success: z.literal(true),
})

export const screenshotKeySchema = z
	.string()
	.regex(
		/^tmp\/screenshots\/[a-z0-9-]+-[0-9]+\.(png|jpe?g|webp|gif)$/,
		'Invalid screenshot key'
	)

// Final keys stored in DB after promote on project submit:
// projects/{slug}/screenshot-{uuid}.ext
export const projectScreenshotKeySchema = z
	.string()
	.regex(
		/^projects\/[a-z0-9]+(?:-[a-z0-9]+)*\/screenshot-[0-9a-f-]{36}\.(png|jpe?g|webp|gif)$/,
		'Invalid project screenshot key'
	)

export const requestScreenshotUploadInputSchema = z.object({
	filename: z.string().trim().min(1).max(100),
	contentType: z.enum(SCREENSHOT_MIME),
	size: z.number().int().min(1).max(SCREENSHOT_MAX_SIZE),
})

export const requestScreenshotUploadOutputSchema = z.object({
	key: screenshotKeySchema,
	presignedUrl: z.url(),
})

export const removeScreenshotUploadInputSchema = z.object({
	key: screenshotKeySchema,
})

export const removeScreenshotUploadOutputSchema = z.object({
	success: z.literal(true),
})

export const changeScreenshotUploadInputSchema = z.object({
	oldKey: screenshotKeySchema,
	newKey: screenshotKeySchema,
})

export const changeScreenshotUploadOutputSchema = z.object({
	success: z.literal(true),
})
