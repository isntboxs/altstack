import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { adminProcedure } from '@altstack/api/procedures'
import { s3, S3_BUCKET, publicUrlForKey } from '@altstack/api/s3'

import { slugify } from '@altstack/shared/lib/slug'

const EXT_BY_MIME = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif',
} as const

const requestLogoUploadHandler =
	adminProcedure.admin.upload.logo.request.handler(async ({ input }) => {
		const rawBase =
			slugify(input.filename.replace(/\.[^.]+$/, '').slice(0, 50)) || 'logo'
		// logoKeySchema only allows [a-z0-9-], but slugify keeps characters
		// like "_" (e.g. "foto_profil"), so normalize here to guarantee the
		// generated key always validates.
		const base =
			rawBase
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '') || 'logo'
		const ext = EXT_BY_MIME[input.contentType]
		const key = `projects/logos/${base}-${Date.now()}.${ext}`

		const cmd = new PutObjectCommand({
			Bucket: S3_BUCKET,
			Key: key,
			ContentType: input.contentType,
			ContentLength: input.size,
		})
		const presignedUrl = await getSignedUrl(s3, cmd, { expiresIn: 600 })

		return { key, presignedUrl, publicUrl: publicUrlForKey(key) }
	})

export const uploadRouter = {
	logo: {
		request: requestLogoUploadHandler,
	},
}
