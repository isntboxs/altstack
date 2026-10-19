// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { LogoUploader, ScreenshotUploader } from '#/components/image-uploader'

const { uploadApi } = vi.hoisted(() => {
	return { uploadApi: { request: vi.fn(), change: vi.fn(), remove: vi.fn() } }
})

vi.mock('#/utils/orpc', () => {
	return {
		client: { admin: { upload: { logo: uploadApi, screenshot: uploadApi } } },
	}
})
vi.mock('#/utils/storage', () => {
	return { publicUrlForKey: (key: string) => `https://images.example/${key}` }
})
vi.mock('@altstack/ui/components/toast', () => {
	return { toast: { add: vi.fn() } }
})
vi.mock('#/components/image-crop-dialog', () => {
	return { ImageCropDialog: () => null }
})

class UploadRequest {
	upload = {}
	status = 204
	onload: (() => void) | null = null
	open = vi.fn()
	setRequestHeader = vi.fn()
	send() {
		queueMicrotask(() => this.onload?.())
	}
	abort = vi.fn()
}

beforeEach(() => {
	vi.resetAllMocks()
	vi.stubGlobal('XMLHttpRequest', UploadRequest)
	vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-upload')
	vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined)
	uploadApi.request.mockResolvedValue({
		key: 'tmp/images/new.gif',
		presignedUrl: 'https://uploads.example/new.gif',
	})
	uploadApi.remove.mockResolvedValue({ success: true })
})

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})

describe.each([
	{ noun: 'logo', Uploader: LogoUploader },
	{ noun: 'screenshot', Uploader: ScreenshotUploader },
])('$noun uploader', ({ noun, Uploader }) => {
	const savedUrl = `https://images.example/projects/example/${noun}.png`

	it('renders saved media after remount and defers its removal to the form', () => {
		const onRemoveExisting = vi.fn()
		const props = { existingUrl: savedUrl, onRemoveExisting }
		const first = render(<Uploader {...props} />)
		expect(screen.getByRole('img', { name: `${noun} preview` })).toHaveProperty(
			'src',
			savedUrl
		)
		first.unmount()
		render(<Uploader {...props} />)
		expect(screen.getByRole('img', { name: `${noun} preview` })).toHaveProperty(
			'src',
			savedUrl
		)
		expect(screen.getByRole('button', { name: `Change ${noun}` })).toBeDefined()
		expect(screen.queryByRole('button', { name: 'Select File' })).toBeNull()
		fireEvent.click(screen.getByRole('button', { name: `Remove ${noun}` }))
		expect(onRemoveExisting).toHaveBeenCalledOnce()
		expect(uploadApi.remove).not.toHaveBeenCalled()
		expect(uploadApi.change).not.toHaveBeenCalled()
	})

	it('reverts a temporary replacement to the saved image without deleting the saved asset', async () => {
		const onRemoveExisting = vi.fn()
		function FormField() {
			const [value, setValue] = useState('')
			return (
				<Uploader
					value={value}
					existingUrl={value ? null : savedUrl}
					onChange={setValue}
					onRemoveExisting={onRemoveExisting}
				/>
			)
		}
		const { container } = render(<FormField />)
		const input = container.querySelector('input[type="file"]')!
		fireEvent.change(input, {
			target: {
				files: [new File(['GIF89a'], 'new.gif', { type: 'image/gif' })],
			},
		})
		await waitFor(() =>
			expect(
				screen.getByRole('img', { name: `${noun} preview` })
			).toHaveProperty('src', 'https://images.example/tmp/images/new.gif')
		)
		expect(uploadApi.change).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole('button', { name: `Remove ${noun}` }))
		await waitFor(() =>
			expect(
				screen.getByRole('img', { name: `${noun} preview` })
			).toHaveProperty('src', savedUrl)
		)
		expect(uploadApi.remove).toHaveBeenCalledOnce()
		expect(uploadApi.remove.mock.calls[0]?.[0]).toEqual({
			body: { key: 'tmp/images/new.gif' },
		})
		expect(onRemoveExisting).not.toHaveBeenCalled()
	})

	it('switches from a temporary preview to the saved URL on save and remount', async () => {
		const onChange = vi.fn()
		const { container, rerender, unmount } = render(
			<Uploader onChange={onChange} />
		)
		fireEvent.change(container.querySelector('input[type="file"]')!, {
			target: {
				files: [new File(['GIF89a'], 'new.gif', { type: 'image/gif' })],
			},
		})
		await waitFor(() =>
			expect(onChange).toHaveBeenCalledWith('tmp/images/new.gif')
		)
		rerender(<Uploader value="tmp/images/new.gif" onChange={onChange} />)
		rerender(<Uploader value="" existingUrl={savedUrl} />)
		expect(screen.getByRole('img', { name: `${noun} preview` })).toHaveProperty(
			'src',
			savedUrl
		)
		unmount()
		render(<Uploader existingUrl={savedUrl} />)
		expect(screen.getByRole('img', { name: `${noun} preview` })).toHaveProperty(
			'src',
			savedUrl
		)
		expect(screen.queryByRole('button', { name: 'Select File' })).toBeNull()
	})

	it('keeps the saved image when a replacement upload fails', async () => {
		uploadApi.request.mockRejectedValue(new Error('Upload unavailable'))
		const onChange = vi.fn()
		const { container } = render(
			<Uploader existingUrl={savedUrl} onChange={onChange} />
		)
		fireEvent.change(container.querySelector('input[type="file"]')!, {
			target: {
				files: [new File(['GIF89a'], 'new.gif', { type: 'image/gif' })],
			},
		})
		await waitFor(() => expect(uploadApi.request).toHaveBeenCalledOnce())
		await waitFor(() =>
			expect(
				screen.getByRole('img', { name: `${noun} preview` })
			).toHaveProperty('src', savedUrl)
		)
		expect(onChange).not.toHaveBeenCalled()
		expect(screen.queryByRole('button', { name: 'Select File' })).toBeNull()
	})
})
