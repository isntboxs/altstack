import {
	CopyObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createRouterClient, ORPCError } from '@orpc/server'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCContext } from '@altstack/api/context'
import { enforceClaimQuota } from '@altstack/api/ownership-otp'
import { requireActiveAccount } from '@altstack/api/queries/account-access'
import { requireProjectMember } from '@altstack/api/queries/ownership'
import { contentImageUploadRouter } from '@altstack/api/routers/upload'

const { send } = vi.hoisted(() => {
	return { send: vi.fn() }
})
vi.mock('@altstack/api/s3', () => {
	return {
		s3: { send },
		S3_BUCKET: 'test-bucket',
		publicUrlForKey: (key: string) => `https://cdn.test/${key}`,
	}
})
vi.mock('@altstack/env/server', () => {
	return {
		env: { CORS_ORIGINS: ['https://app.test'] },
	}
})
vi.mock('@aws-sdk/s3-request-presigner', () => {
	return { getSignedUrl: vi.fn() }
})
vi.mock('@altstack/api/ownership-otp', () => {
	return { enforceClaimQuota: vi.fn() }
})
vi.mock('@altstack/api/queries/account-access', () => {
	return {
		requireActiveAccount: vi.fn(),
	}
})
vi.mock('@altstack/api/queries/ownership', () => {
	return {
		requireProjectMember: vi.fn(),
	}
})

const projectId = '550e8400-e29b-41d4-a716-446655440004'
const body = {
	filename: 'diagram.png',
	contentType: 'image/png' as const,
	size: 1024,
}
const database = {} as ORPCContext['db']
function client(
	role: 'admin' | 'user' | null = 'admin',
	id = 'editor',
	headers?: Headers
) {
	return createRouterClient(contentImageUploadRouter, {
		context: {
			db: database,
			auth: role ? ({ user: { id, role } } as ORPCContext['auth']) : null,
			requestHeaders: headers,
		},
	})
}

beforeEach(() => {
	vi.resetAllMocks()
	vi.mocked(requireActiveAccount).mockResolvedValue({
		id: 'editor',
		role: 'admin',
	})
	vi.mocked(getSignedUrl).mockResolvedValue('https://s3.test/signed')
	send.mockResolvedValue({ ContentLength: 1024, ContentType: 'image/png' })
})

describe('content image uploads', () => {
	it('signs unique temporary keys and publishes a stable public URL after verification', async () => {
		const rpc = client()
		const upload = await rpc.request({ body })
		const other = await rpc.request({ body })
		expect(upload.key).not.toBe(other.key)
		expect(upload.key).toMatch(
			/^tmp\/content-images\/[a-f0-9]{64}\/[a-f0-9-]{36}\.png$/
		)
		const command = vi.mocked(getSignedUrl).mock.calls[0]?.[1]
		expect(command).toBeInstanceOf(PutObjectCommand)
		expect(command?.input).toMatchObject({
			Bucket: 'test-bucket',
			Key: upload.key,
			ContentLength: 1024,
			ContentType: 'image/png',
		})
		expect(enforceClaimQuota).toHaveBeenCalledWith(
			database,
			'content-image:editor',
			40
		)
		expect(vi.mocked(getSignedUrl).mock.calls[0]?.[2]).toEqual({
			expiresIn: 600,
			signableHeaders: new Set(['content-type']),
		})
		const result = await rpc.complete({ body: { key: upload.key } })
		expect(result.url).toBe(
			`https://cdn.test/${upload.key.replace('tmp/content-images/', 'content/images/')}`
		)
		expect(result.url).not.toContain('signed')
		expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand)
		expect(send.mock.calls[1]?.[0]).toBeInstanceOf(CopyObjectCommand)
		expect(
			send.mock.calls.some(([cmd]) => cmd instanceof DeleteObjectCommand)
		).toBe(false)
		expect(await rpc.complete({ body: { key: upload.key } })).toEqual(result)
	})

	it('rejects anonymous callers, non-editors and cross-site requests before signing', async () => {
		await expect(client(null).request({ body })).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
		})
		vi.mocked(requireActiveAccount).mockResolvedValue({
			id: 'editor',
			role: 'user',
		})
		await expect(client('user').request({ body })).rejects.toMatchObject({
			code: 'FORBIDDEN',
		})
		await expect(
			client(
				'user',
				'editor',
				new Headers({ origin: 'https://evil.test' })
			).request({ body: { ...body, projectId } })
		).rejects.toMatchObject({ code: 'FORBIDDEN' })
		expect(getSignedUrl).not.toHaveBeenCalled()
	})

	it('checks active project membership again on completion', async () => {
		vi.mocked(requireActiveAccount).mockResolvedValue({
			id: 'editor',
			role: 'user',
		})
		const rpc = client('user')
		const upload = await rpc.request({ body: { ...body, projectId } })
		expect(requireProjectMember).toHaveBeenCalledWith(
			database,
			projectId,
			'editor'
		)
		vi.mocked(requireProjectMember).mockRejectedValue(
			new ORPCError('NOT_FOUND')
		)
		await expect(
			rpc.complete({ body: { key: upload.key, projectId } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		expect(send).not.toHaveBeenCalled()
	})

	it('does not complete uploads belonging to another user or project scope', async () => {
		const upload = await client().request({ body: { ...body, projectId } })
		await expect(
			client('admin', 'another').complete({
				body: { key: upload.key, projectId },
			})
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		await expect(
			client().complete({ body: { key: upload.key } })
		).rejects.toMatchObject({ code: 'NOT_FOUND' })
		expect(send).not.toHaveBeenCalled()
	})

	it.each([
		{ contentType: 'image/svg+xml' },
		{ contentType: 'text/html' },
		{ size: 0 },
		{ size: 5 * 1024 * 1024 + 1 },
	])('rejects unsupported uploads before signing: %j', async (patch) => {
		await expect(
			client().request({ body: { ...body, ...patch } as typeof body })
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		expect(getSignedUrl).not.toHaveBeenCalled()
	})

	it.each([
		{ ContentLength: 0, ContentType: 'image/png' },
		{ ContentLength: 6 * 1024 * 1024, ContentType: 'image/png' },
		{ ContentLength: 1024, ContentType: 'text/html' },
	])(
		'rejects invalid stored metadata before publishing: %j',
		async (metadata) => {
			const upload = await client().request({ body })
			send.mockResolvedValueOnce(metadata)
			await expect(
				client().complete({ body: { key: upload.key } })
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
			expect(
				send.mock.calls.some(([cmd]) => cmd instanceof CopyObjectCommand)
			).toBe(false)
		}
	)

	it('reports an expired upload and blocks signing when quota is exhausted', async () => {
		const upload = await client().request({ body })
		send.mockRejectedValueOnce({ $metadata: { httpStatusCode: 404 } })
		await expect(
			client().complete({ body: { key: upload.key } })
		).rejects.toMatchObject({ code: 'UPLOAD_EXPIRED' })
		vi.mocked(enforceClaimQuota).mockRejectedValue(
			new ORPCError('TOO_MANY_REQUESTS')
		)
		vi.mocked(getSignedUrl).mockClear()
		await expect(client().request({ body })).rejects.toMatchObject({
			code: 'TOO_MANY_REQUESTS',
		})
		expect(getSignedUrl).not.toHaveBeenCalled()
	})
})
