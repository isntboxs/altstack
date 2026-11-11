import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { expect, it, vi } from 'vite-plus/test'

import { s3 } from '@altstack/api/s3'

vi.mock('@altstack/env/server', () => {
	return {
		env: {
			S3_REGION: 'auto',
			S3_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
			S3_BUCKET: 'test-bucket',
			S3_PUBLIC_URL: 'https://cdn.test',
			S3_ACCESS_KEY_ID: 'synthetic-test-access',
			S3_SECRET_ACCESS_KEY: 'synthetic-test-secret',
		},
	}
})

it('signs browser PUTs without a checksum for the absent signing-time body', async () => {
	const url = new URL(
		await getSignedUrl(
			s3,
			new PutObjectCommand({
				Bucket: 'test-bucket',
				Key: 'image.png',
				ContentLength: 3,
				ContentType: 'image/png',
			}),
			{ expiresIn: 600, signableHeaders: new Set(['content-type']) }
		)
	)
	expect(url.searchParams.has('x-amz-checksum-crc32')).toBe(false)
	expect(url.searchParams.has('x-amz-sdk-checksum-algorithm')).toBe(false)
	expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain(
		'content-length'
	)
	expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-type')
	expect(url.searchParams.get('X-Amz-Expires')).toBe('600')
})
