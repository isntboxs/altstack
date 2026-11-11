import {
	DeleteObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { ORPCErrorConstructorMap } from '@orpc/server'
import { createHash, randomUUID } from 'node:crypto'

import { enforceClaimQuota } from '@altstack/api/ownership-otp'
import { adminProcedure, protectedProcedure } from '@altstack/api/procedures'
import { requireActiveAccount } from '@altstack/api/queries/account-access'
import { requireProjectMember } from '@altstack/api/queries/ownership'
import { s3, S3_BUCKET, publicUrlForKey } from '@altstack/api/s3'
import {
	promoteContentImage,
	InvalidTempUploadError,
	TempUploadMissingError,
} from '@altstack/api/storage'

import { env } from '@altstack/env/server'

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

export const LOGO_KIND = {
	prefix: TMP_LOGO_PREFIX,
	fallbackBase: 'logo',
} as const
export const SCREENSHOT_KIND = {
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

export async function requestImageUpload(
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

	return { key, presignedUrl }
}

export async function removeImageUpload(
	key: string,
	errors: ImageUploadErrors
) {
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

export async function changeImageUpload(
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
		requestImageUpload(input.body, LOGO_KIND)
	)

const removeLogoUploadHandler = adminProcedure.admin.upload.logo.remove.handler(
	async ({ errors, input }) => removeImageUpload(input.body.key, errors)
)

const changeLogoUploadHandler = adminProcedure.admin.upload.logo.change.handler(
	async ({ errors, input }) =>
		changeImageUpload(input.body.oldKey, input.body.newKey, errors)
)

const requestScreenshotUploadHandler =
	adminProcedure.admin.upload.screenshot.request.handler(async ({ input }) =>
		requestImageUpload(input.body, SCREENSHOT_KIND)
	)

const removeScreenshotUploadHandler =
	adminProcedure.admin.upload.screenshot.remove.handler(
		async ({ errors, input }) => removeImageUpload(input.body.key, errors)
	)

const changeScreenshotUploadHandler =
	adminProcedure.admin.upload.screenshot.change.handler(
		async ({ errors, input }) =>
			changeImageUpload(input.body.oldKey, input.body.newKey, errors)
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

const contentImageProcedure = protectedProcedure.use(
	async ({ context, next, errors }) => {
		const origin = context.requestHeaders?.get('origin')
		if (
			(origin && !env.CORS_ORIGINS.includes(origin)) ||
			context.requestHeaders?.get('sec-fetch-site') === 'cross-site'
		) {
			throw errors.FORBIDDEN()
		}
		const account = await requireActiveAccount(context.db, context.auth.user.id)
		return next({ context: { account } })
	}
)

function contentImagePrefix(userId: string, projectId?: string) {
	const scope = createHash('sha256')
		.update(JSON.stringify([userId, projectId ?? null]))
		.digest('hex')
	return `tmp/content-images/${scope}/`
}

export const contentImageUploadRouter = {
	request: contentImageProcedure.contentImageUpload.request.handler(
		async ({ context: { db, auth, account }, input: { body }, errors }) => {
			if (account.role !== 'admin') {
				if (!body.projectId) throw errors.FORBIDDEN()
				await requireProjectMember(db, body.projectId, auth.user.id)
			}
			await enforceClaimQuota(db, `content-image:${auth.user.id}`, 40)
			const key = `${contentImagePrefix(auth.user.id, body.projectId)}${randomUUID()}.${EXT_BY_MIME[body.contentType]}`
			const presignedUrl = await getSignedUrl(
				s3,
				new PutObjectCommand({
					Bucket: S3_BUCKET,
					Key: key,
					ContentType: body.contentType,
					ContentLength: body.size,
				}),
				{ expiresIn: 600, signableHeaders: new Set(['content-type']) }
			)
			return { key, presignedUrl }
		}
	),
	complete: contentImageProcedure.contentImageUpload.complete.handler(
		async ({ context: { db, auth, account }, input: { body }, errors }) => {
			if (account.role !== 'admin') {
				if (!body.projectId) throw errors.FORBIDDEN()
				await requireProjectMember(db, body.projectId, auth.user.id)
			}
			if (
				!body.key.startsWith(contentImagePrefix(auth.user.id, body.projectId))
			) {
				throw errors.NOT_FOUND()
			}
			try {
				const key = await promoteContentImage(body.key)
				return { url: publicUrlForKey(key) }
			} catch (error) {
				if (error instanceof TempUploadMissingError) {
					throw errors.UPLOAD_EXPIRED()
				}
				if (error instanceof InvalidTempUploadError) throw errors.BAD_REQUEST()
				throw errors.INTERNAL_SERVER_ERROR()
			}
		}
	),
}
