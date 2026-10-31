import {
	CopyObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import {
	promoteTempImageToBlogCover,
	promoteTempImageToProject,
	InvalidTempUploadError,
	TempUploadMissingError,
	StorageError,
} from '@altstack/api/storage'

const { send } = vi.hoisted(() => {
	return {
		send: vi.fn<
			(
				command: unknown
			) => Promise<{ ContentLength?: number; ContentType?: string }>
		>(),
	}
})

vi.mock('@altstack/api/s3', () => {
	return {
		s3: { send },
		S3_BUCKET: 'test-bucket',
	}
})
const postId = '550e8400-e29b-41d4-a716-446655440004'
const tmpKey = 'tmp/screenshots/cover-1.png'
beforeEach(() =>
	send
		.mockReset()
		.mockResolvedValue({ ContentLength: 1024, ContentType: 'image/png' })
)

describe('blog cover storage', () => {
	it('verifies and copies a cover into the post folder without consuming the retryable upload', async () => {
		const key = await promoteTempImageToBlogCover({ tmpKey, postId })
		expect(key).toMatch(new RegExp(`^blogs/${postId}/cover-[a-f0-9-]+\\.png$`))
		const commands = send.mock.calls.map(([command]) => command)
		expect(commands[0]).toBeInstanceOf(HeadObjectCommand)
		expect(commands[1]).toBeInstanceOf(CopyObjectCommand)
		expect(
			commands.find((command) => command instanceof CopyObjectCommand)?.input
		).toMatchObject({
			CopySource: `test-bucket/${tmpKey}`,
			Key: key,
		})
		expect(commands[2]).toBeInstanceOf(HeadObjectCommand)
		expect(
			commands.some((command) => command instanceof DeleteObjectCommand)
		).toBe(false)
	})
	it('preserves screenshot promotion behavior for projects', async () => {
		await promoteTempImageToProject({
			tmpKey,
			slug: 'existing-project',
			kind: 'screenshot',
		})
		const commands = send.mock.calls.map(([command]) => command)
		expect(commands.at(-1)).toBeInstanceOf(DeleteObjectCommand)
		expect(
			commands.find((command) => command instanceof DeleteObjectCommand)?.input
				.Key
		).toBe(tmpKey)
	})
	it.each([
		{ ContentLength: 6 * 1024 * 1024, ContentType: 'image/png' },
		{ ContentLength: 20, ContentType: 'text/html' },
	])(
		'rejects stored objects outside the screenshot limits: %j',
		async (metadata) => {
			send.mockResolvedValueOnce(metadata)
			await expect(
				promoteTempImageToBlogCover({ tmpKey, postId })
			).rejects.toBeInstanceOf(InvalidTempUploadError)
			expect(
				send.mock.calls.some(
					([command]) => command instanceof CopyObjectCommand
				)
			).toBe(false)
		}
	)
	it('reports expired uploads and rejects arbitrary source or destination keys', async () => {
		send.mockRejectedValueOnce({
			$metadata: { httpStatusCode: 404 },
		})
		await expect(
			promoteTempImageToBlogCover({ tmpKey, postId })
		).rejects.toBeInstanceOf(TempUploadMissingError)
		for (const input of [
			{ tmpKey: 'projects/another/screenshot.png', postId },
			{ tmpKey, postId: '../another-post' },
		]) {
			await expect(promoteTempImageToBlogCover(input)).rejects.toBeInstanceOf(
				StorageError
			)
		}
	})
	it('cleans up a failed copy without deleting the temporary source', async () => {
		send
			.mockResolvedValueOnce({ ContentLength: 1024, ContentType: 'image/png' })
			.mockRejectedValueOnce(new Error('Copy failed'))
		await expect(
			promoteTempImageToBlogCover({ tmpKey, postId })
		).rejects.toBeInstanceOf(StorageError)
		const deletions = send.mock.calls
			.map(([command]) => command)
			.filter((command) => command instanceof DeleteObjectCommand)
		expect(deletions).toHaveLength(1)
		expect(deletions[0]?.input.Key).toMatch(/^blogs\//)
	})
})
