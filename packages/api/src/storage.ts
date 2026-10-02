import {
	CopyObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { randomUUID } from 'node:crypto'

import { s3, S3_BUCKET } from '@altstack/api/s3'

export type ProjectImageKind = 'logo' | 'screenshot'

export class TempUploadMissingError extends Error {
	constructor(message = 'Temporary upload not found') {
		super(message)
		this.name = 'TempUploadMissingError'
	}
}

export class StorageError extends Error {
	constructor(message = 'Storage operation failed') {
		super(message)
		this.name = 'StorageError'
	}
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const EXT_PATTERN = /\.(png|jpe?g|webp|gif)$/i

const TMP_PREFIX_BY_KIND = {
	logo: 'tmp/logos/',
	screenshot: 'tmp/screenshots/',
} as const

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif',
}

export function isS3NotFoundError(error: unknown): boolean {
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

export function extractImageExtension(key: string): string | null {
	const match = EXT_PATTERN.exec(key)
	if (!match?.[1]) return null
	const ext = match[1].toLowerCase()
	// Uploads normalize image/jpeg -> jpg, keep finals consistent.
	if (ext === 'jpeg') return 'jpg'
	return ext
}

export function buildFinalLogoKey(slug: string, ext: string): string {
	return `projects/${slug}/logo-${randomUUID()}.${ext}`
}

export function buildFinalScreenshotKey(slug: string, ext: string): string {
	return `projects/${slug}/screenshot-${randomUUID()}.${ext}`
}

function assertValidPromoteInput(
	tmpKey: string,
	slug: string,
	kind: ProjectImageKind
) {
	if (!SLUG_PATTERN.test(slug)) {
		throw new StorageError(`Invalid slug for final key: ${slug}`)
	}

	const expectedPrefix = TMP_PREFIX_BY_KIND[kind]
	if (!tmpKey.startsWith(expectedPrefix)) {
		throw new StorageError(
			`Expected ${kind} temp key to start with ${expectedPrefix}`
		)
	}
}

interface PromoteTempImageInput {
	tmpKey: string
	slug: string
	kind: ProjectImageKind
}

/**
 * Copy tmp/logos|tmp/screenshots object to projects/{slug}/...,
 * verify the copy, then delete the temp source.
 *
 * Reusable for create + future update flows. Temp orphans that never get
 * promoted are expected to expire via S3 lifecycle on tmp/*.
 */
export async function promoteTempImageToProject({
	tmpKey,
	slug,
	kind,
}: PromoteTempImageInput): Promise<string> {
	assertValidPromoteInput(tmpKey, slug, kind)

	const ext = extractImageExtension(tmpKey)
	if (!ext) {
		throw new StorageError(`Cannot determine extension for ${tmpKey}`)
	}

	const finalKey =
		kind === 'logo'
			? buildFinalLogoKey(slug, ext)
			: buildFinalScreenshotKey(slug, ext)

	let contentType: string | undefined
	try {
		const head = await s3.send(
			new HeadObjectCommand({ Bucket: S3_BUCKET, Key: tmpKey })
		)
		contentType =
			head.ContentType ?? CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream'
	} catch (error) {
		if (isS3NotFoundError(error)) {
			throw new TempUploadMissingError(`Temporary ${kind} not found: ${tmpKey}`)
		}
		throw new StorageError(`Failed to read temporary ${kind}`)
	}

	try {
		await s3.send(
			new CopyObjectCommand({
				Bucket: S3_BUCKET,
				Key: finalKey,
				CopySource: `${S3_BUCKET}/${tmpKey}`,
				ContentType: contentType,
				MetadataDirective: 'REPLACE',
			})
		)
	} catch {
		throw new StorageError(`Failed to promote temporary ${kind}`)
	}

	try {
		await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: finalKey }))
	} catch {
		throw new StorageError(`Failed to verify promoted ${kind}`)
	}

	try {
		await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: tmpKey }))
	} catch {
		// Copy already succeeded and is verified; a leftover tmp object will
		// expire via lifecycle, so don't fail the whole operation.
	}

	return finalKey
}

/**
 * Best-effort cleanup for final objects when DB insert fails after promote.
 * Never throws — orphan finals are worse than silent failures here.
 */
export async function deleteFinalKeysBestEffort(
	keys: Array<string>
): Promise<void> {
	await Promise.all(
		keys.map(async (key) => {
			try {
				await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
			} catch {
				// ignore
			}
		})
	)
}

interface MoveProjectFolderInput {
	oldSlug: string
	newSlug: string
}

/**
 * Move all objects from projects/{oldSlug}/ to projects/{newSlug}/.
 * Used when a project slug is renamed. Returns the key mapping so callers
 * can update DB rows. Empty array when nothing to move.
 */
export async function moveProjectFolder({
	oldSlug,
	newSlug,
}: MoveProjectFolderInput): Promise<Array<{ oldKey: string; newKey: string }>> {
	if (!SLUG_PATTERN.test(oldSlug) || !SLUG_PATTERN.test(newSlug)) {
		throw new StorageError('Invalid slug for folder move')
	}

	if (oldSlug === newSlug) return []

	const oldPrefix = `projects/${oldSlug}/`
	const newPrefix = `projects/${newSlug}/`
	const moved: Array<{ oldKey: string; newKey: string }> = []

	let continuationToken: string | undefined
	do {
		const listed = await s3
			.send(
				new ListObjectsV2Command({
					Bucket: S3_BUCKET,
					Prefix: oldPrefix,
					ContinuationToken: continuationToken,
				})
			)
			.catch(() => {
				throw new StorageError('Failed to list project folder')
			})

		const contents = listed.Contents ?? []
		for (const object of contents) {
			if (!object.Key) continue
			const suffix = object.Key.slice(oldPrefix.length)
			if (!suffix) continue
			const newKey = `${newPrefix}${suffix}`

			try {
				const head = await s3.send(
					new HeadObjectCommand({ Bucket: S3_BUCKET, Key: object.Key })
				)
				await s3.send(
					new CopyObjectCommand({
						Bucket: S3_BUCKET,
						Key: newKey,
						CopySource: `${S3_BUCKET}/${object.Key}`,
						ContentType: head.ContentType,
						MetadataDirective: 'REPLACE',
					})
				)
				await s3.send(
					new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: object.Key })
				)
				moved.push({ oldKey: object.Key, newKey })
			} catch {
				throw new StorageError(`Failed to move ${object.Key}`)
			}
		}

		continuationToken = listed.IsTruncated
			? listed.NextContinuationToken
			: undefined
	} while (continuationToken)

	return moved
}
