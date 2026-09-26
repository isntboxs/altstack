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
		const base =
			slugify(input.filename.replace(/\.[^.]+$/, '').slice(0, 50)) || 'logo'
		const ext = EXT_BY_MIME[input.contentType]
		const key = `projects/logos/${base}-${Date.now()}${crypto.randomUUID().slice(0, 8)}.${ext}`

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
