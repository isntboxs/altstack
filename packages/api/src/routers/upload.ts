import {
	DeleteObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { ORPCErrorConstructorMap } from '@orpc/server'

import { adminProcedure } from '@altstack/api/procedures'
import { s3, S3_BUCKET, publicUrlForKey } from '@altstack/api/s3'

import {
	TMP_LOGO_PREFIX,
	TMP_SCREENSHOT_PREFIX,
} from '@altstack/shared/constants'
import type { ORPC_ERRORS } from '@altstack/shared/constants/orpc-errors'
import { slugify } from '@altstack/shared/lib/slug'

const EXT_BY_MIME = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif',
} as const

type ImageUploadErrors = ORPCErrorConstructorMap<typeof ORPC_ERRORS>

interface ImageUploadKind {
	prefix: string
	fallbackBase: string
}

interface ImageUploadRequestInput {
	filename: string
	contentType: keyof typeof EXT_BY_MIME
	size: number
}

const LOGO_KIND = { prefix: TMP_LOGO_PREFIX, fallbackBase: 'logo' } as const
const SCREENSHOT_KIND = {
	prefix: TMP_SCREENSHOT_PREFIX,
	fallbackBase: 'screenshot',
} as const

const buildImageKey = (
	kind: ImageUploadKind,
	filename: string,
	ext: string
) => {
	const rawBase =
		slugify(filename.replace(/\.[^.]+$/, '').slice(0, 50)) || kind.fallbackBase
	// Key schemas only allow [a-z0-9-], but slugify keeps characters
	// like "_" (e.g. "foto_profil"), so normalize here to guarantee the
	// generated key always validates.
	const base =
		rawBase
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || kind.fallbackBase
	return `${kind.prefix}${base}-${Date.now()}.${ext}`
}

async function requestImageUpload(
	input: ImageUploadRequestInput,
	kind: ImageUploadKind
) {
	const ext = EXT_BY_MIME[input.contentType]
	const key = buildImageKey(kind, input.filename, ext)

	const cmd = new PutObjectCommand({
		Bucket: S3_BUCKET,
		Key: key,
		ContentType: input.contentType,
		ContentLength: input.size,
	})
	const presignedUrl = await getSignedUrl(s3, cmd, { expiresIn: 600 })

	return { key, presignedUrl, publicUrl: publicUrlForKey(key) }
}

async function removeImageUpload(key: string, errors: ImageUploadErrors) {
	try {
		await s3.send(
			new DeleteObjectCommand({
				Bucket: S3_BUCKET,
				Key: key,
			})
		)
	} catch {
		throw errors.INTERNAL_SERVER_ERROR()
	}

	return { success: true as const }
}

function isNotFoundError(error: unknown): boolean {
	if (typeof error !== 'object' || error === null) return false

	if ('$metadata' in error) {
		const metadata = (error as { $metadata?: { httpStatusCode?: number } })
			.$metadata
		if (metadata?.httpStatusCode === 404) return true
	}

	return (
		'code' in error &&
		((error as { code?: unknown }).code === 'NotFound' ||
			(error as { code?: unknown }).code === 'NoSuchKey')
	)
}

async function changeImageUpload(
	oldKey: string,
	newKey: string,
	errors: ImageUploadErrors
) {
	if (oldKey === newKey) {
		return { success: true as const }
	}

	try {
		await s3.send(
			new HeadObjectCommand({
				Bucket: S3_BUCKET,
				Key: newKey,
			})
		)
	} catch (error) {
		if (isNotFoundError(error)) throw errors.NOT_FOUND()
		throw errors.INTERNAL_SERVER_ERROR()
	}

	try {
		await s3.send(
			new DeleteObjectCommand({
				Bucket: S3_BUCKET,
				Key: oldKey,
			})
		)
	} catch {
		throw errors.INTERNAL_SERVER_ERROR()
	}

	return { success: true as const }
}

const requestLogoUploadHandler =
	adminProcedure.admin.upload.logo.request.handler(async ({ input }) =>
		requestImageUpload(input, LOGO_KIND)
	)

const removeLogoUploadHandler = adminProcedure.admin.upload.logo.remove.handler(
	async ({ errors, input }) => removeImageUpload(input.key, errors)
)

const changeLogoUploadHandler = adminProcedure.admin.upload.logo.change.handler(
	async ({ errors, input }) =>
		changeImageUpload(input.oldKey, input.newKey, errors)
)

const requestScreenshotUploadHandler =
	adminProcedure.admin.upload.screenshot.request.handler(async ({ input }) =>
		requestImageUpload(input, SCREENSHOT_KIND)
	)

const removeScreenshotUploadHandler =
	adminProcedure.admin.upload.screenshot.remove.handler(
		async ({ errors, input }) => removeImageUpload(input.key, errors)
	)

const changeScreenshotUploadHandler =
	adminProcedure.admin.upload.screenshot.change.handler(
		async ({ errors, input }) =>
			changeImageUpload(input.oldKey, input.newKey, errors)
	)

export const uploadRouter = {
	logo: {
		request: requestLogoUploadHandler,
		remove: removeLogoUploadHandler,
		change: changeLogoUploadHandler,
	},
	screenshot: {
		request: requestScreenshotUploadHandler,
		remove: removeScreenshotUploadHandler,
		change: changeScreenshotUploadHandler,
	},
}
