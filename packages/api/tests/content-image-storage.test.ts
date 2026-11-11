import {
	CopyObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { promoteContentImage, StorageError } from '@altstack/api/storage'

type StorageCommand =
	| CopyObjectCommand
	| DeleteObjectCommand
	| HeadObjectCommand
type ImageMetadata = { ContentLength: number; ContentType: string }

const { send } = vi.hoisted(() => {
	return {
		send: vi.fn<(command: StorageCommand) => Promise<Partial<ImageMetadata>>>(),
	}
})
vi.mock('@altstack/api/s3', () => {
	return { s3: { send }, S3_BUCKET: 'test-bucket' }
})

const tmpKey = `tmp/content-images/${'a'.repeat(64)}/550e8400-e29b-41d4-a716-446655440004.png`
const finalKey = tmpKey.replace('tmp/content-images/', 'content/images/')
const image = { ContentLength: 1024, ContentType: 'image/png' }
const objects = new Map<string, ImageMetadata>()
const notFound = () =>
	Object.assign(new Error('Not found'), {
		$metadata: { httpStatusCode: 404 },
	})

function sendCommand(command: StorageCommand) {
	const key = command.input.Key!
	if (command instanceof HeadObjectCommand) {
		const metadata = objects.get(key)
		if (!metadata) return Promise.reject(notFound())
		return Promise.resolve(metadata)
	}
	if (command instanceof CopyObjectCommand) {
		const source = command.input.CopySource!.slice('test-bucket/'.length)
		const metadata = objects.get(source)
		if (!metadata) return Promise.reject(notFound())
		objects.set(key, metadata)
		return Promise.resolve({})
	}
	objects.delete(key)
	return Promise.resolve({})
}

beforeEach(() => {
	objects.clear()
	objects.set(tmpKey, image)
	send.mockReset().mockImplementation(sendCommand)
})

describe('content image completion retries', () => {
	it('returns the published key after its temporary source expires without copying again', async () => {
		expect(await promoteContentImage(tmpKey)).toBe(finalKey)
		objects.delete(tmpKey)
		send.mockClear()
		expect(await promoteContentImage(tmpKey)).toBe(finalKey)
		expect(objects.get(finalKey)).toEqual(image)
		expect(send).toHaveBeenCalledExactlyOnceWith(expect.any(HeadObjectCommand))
	})

	it('does not overwrite a published image when the temporary source changes', async () => {
		await promoteContentImage(tmpKey)
		objects.set(tmpKey, { ContentLength: 2048, ContentType: 'image/jpeg' })
		send.mockClear()
		await promoteContentImage(tmpKey)
		expect(objects.get(finalKey)).toEqual(image)
		expect(
			send.mock.calls.some(([command]) => command instanceof CopyObjectCommand)
		).toBe(false)
	})

	it('preserves a published image when the retry destination lookup fails', async () => {
		await promoteContentImage(tmpKey)
		send.mockRejectedValueOnce(new Error('Storage unavailable'))
		await expect(promoteContentImage(tmpKey)).rejects.toBeInstanceOf(
			StorageError
		)
		expect(objects.get(finalKey)).toEqual(image)
		expect(
			send.mock.calls.some(
				([command]) => command instanceof DeleteObjectCommand
			)
		).toBe(false)
		expect(await promoteContentImage(tmpKey)).toBe(finalKey)
	})

	it.each(['copy', 'verification'] as const)(
		'preserves a concurrently published image when %s fails after a missing destination lookup',
		async (failure) => {
			let destinationLookups = 0
			send.mockImplementation(async (command) => {
				if (
					command instanceof HeadObjectCommand &&
					command.input.Key === finalKey
				) {
					destinationLookups += 1
					if (destinationLookups === 1) {
						// A competing completion publishes after this request saw no object.
						objects.set(finalKey, image)
						throw notFound()
					}
					if (failure === 'verification') throw new Error('HEAD failed')
				}
				if (failure === 'copy' && command instanceof CopyObjectCommand) {
					throw new Error('Copy failed')
				}
				return sendCommand(command)
			})
			await expect(promoteContentImage(tmpKey)).rejects.toBeInstanceOf(
				StorageError
			)
			expect(objects.get(finalKey)).toEqual(image)
			expect(
				send.mock.calls.some(
					([command]) => command instanceof DeleteObjectCommand
				)
			).toBe(false)
			send.mockImplementation(sendCommand)
			objects.delete(tmpKey)
			expect(await promoteContentImage(tmpKey)).toBe(finalKey)
		}
	)

	it('recovers a lost copy response without deleting the copied image', async () => {
		send.mockImplementation(async (command) => {
			const result = await sendCommand(command)
			if (command instanceof CopyObjectCommand) throw new Error('Response lost')
			return result
		})
		await expect(promoteContentImage(tmpKey)).rejects.toBeInstanceOf(
			StorageError
		)
		expect(objects.get(finalKey)).toEqual(image)
		send.mockImplementation(sendCommand)
		objects.delete(tmpKey)
		expect(await promoteContentImage(tmpKey)).toBe(finalKey)
	})
})
