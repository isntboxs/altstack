// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import {
	uploadContentImage,
	uploadEditorImage,
	canSaveEditorContent,
} from '#/components/block-note/upload-image'

const { request, complete, toast } = vi.hoisted(() => {
	return {
		request: vi.fn(),
		complete: vi.fn(),
		toast: vi.fn(),
	}
})
vi.mock('#/utils/orpc', () => {
	return {
		client: { contentImageUpload: { request, complete } },
	}
})
vi.mock('@altstack/ui/components/toast', () => {
	return { toast: { add: toast } }
})

beforeEach(() => {
	vi.resetAllMocks()
	request.mockResolvedValue({
		key: 'tmp/content-images/test.png',
		presignedUrl: 'https://s3.test/signed',
	})
	complete.mockResolvedValue({
		url: 'https://cdn.test/content/images/test.png',
	})
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})
afterEach(() => vi.unstubAllGlobals())

describe('Markdown image upload client', () => {
	it('uploads using the signed PUT then returns only the permanent URL', async () => {
		const file = new File(['png'], 'image.png', { type: 'image/png' })
		expect(await uploadContentImage(file)).toBe(
			'https://cdn.test/content/images/test.png'
		)
	})
	it('passes project scope and the declared image type to the API and storage', async () => {
		const projectId = '550e8400-e29b-41d4-a716-446655440004'
		const file = new File(['png'], 'image.png', { type: 'image/png' })
		await uploadContentImage(file, projectId)
		expect(request).toHaveBeenCalledWith({
			body: {
				filename: 'image.png',
				contentType: 'image/png',
				size: 3,
				projectId,
			},
		})
		expect(fetch).toHaveBeenCalledWith('https://s3.test/signed', {
			method: 'PUT',
			body: file,
			headers: { 'Content-Type': 'image/png' },
		})
		expect(complete).toHaveBeenCalledWith({
			body: { key: 'tmp/content-images/test.png', projectId },
		})
	})
	it('does not publish a failed PUT and exposes completion failures', async () => {
		const file = new File(['png'], 'image.png', { type: 'image/png' })
		vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response)
		await expect(uploadContentImage(file)).rejects.toThrow(
			'Image upload failed'
		)
		expect(complete).not.toHaveBeenCalled()
		complete.mockRejectedValueOnce(new Error('Storage unavailable'))
		await expect(uploadContentImage(file)).rejects.toThrow(
			'Storage unavailable'
		)
	})
	it.each([
		new File(['svg'], 'image.svg', { type: 'image/svg+xml' }),
		new File([], 'empty.png', { type: 'image/png' }),
		new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.png', {
			type: 'image/png',
		}),
	])(
		'validates image type and size before requesting storage access: $name',
		async (file) => {
			await expect(uploadContentImage(file)).rejects.toThrow('up to 5 MB')
			expect(request).not.toHaveBeenCalled()
			expect(fetch).not.toHaveBeenCalled()
		}
	)
	it('prevents saving during an upload and allows saving when it finishes', () => {
		expect(canSaveEditorContent({ isUploading: () => true })).toBe(false)
		expect(toast).toHaveBeenCalledWith(
			expect.objectContaining({ title: 'Image upload in progress' })
		)
		expect(canSaveEditorContent({ isUploading: () => false })).toBe(true)
	})

	it('tracks concurrent uploads and clears pending state after failures', async () => {
		const pending = { current: 0 }
		let finish!: (value: { url: string }) => void
		complete.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve
				})
		)
		const file = new File(['png'], 'image.png', { type: 'image/png' })
		const first = uploadEditorImage(file, undefined, pending)
		expect(pending.current).toBe(1)
		const failed = uploadEditorImage(
			new File(['svg'], 'bad.svg', { type: 'image/svg+xml' }),
			undefined,
			pending
		)
		await expect(failed).rejects.toThrow('up to 5 MB')
		expect(pending.current).toBe(1)
		await vi.waitFor(() => expect(complete).toHaveBeenCalled())
		finish({ url: 'https://cdn.test/image.png' })
		await expect(first).resolves.toBe('https://cdn.test/image.png')
		expect(pending.current).toBe(0)
		expect(toast).toHaveBeenCalledWith(
			expect.objectContaining({ title: 'Could not upload image' })
		)
	})
})
