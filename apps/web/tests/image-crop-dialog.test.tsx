// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { ImageCropDialog } from '#/components/image-crop-dialog'
import { getCroppedImageFile } from '#/utils/crop-image'

vi.mock('#/utils/crop-image', () => {
	return { getCroppedImageFile: vi.fn() }
})

let sourceWidth = 600
let sourceHeight = 580

beforeEach(() => {
	sourceWidth = 600
	sourceHeight = 580
	vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
		function (this: HTMLElement) {
			return this.classList.contains('reactEasyCrop_Container')
				? new DOMRect(0, 0, 544, 288)
				: new DOMRect()
		}
	)
	vi.spyOn(
		HTMLImageElement.prototype,
		'naturalWidth',
		'get'
	).mockImplementation(() => sourceWidth)
	vi.spyOn(
		HTMLImageElement.prototype,
		'naturalHeight',
		'get'
	).mockImplementation(() => sourceHeight)
	vi.spyOn(HTMLImageElement.prototype, 'offsetWidth', 'get').mockImplementation(
		() => Math.min(1, 544 / sourceWidth, 288 / sourceHeight) * sourceWidth
	)
	vi.spyOn(
		HTMLImageElement.prototype,
		'offsetHeight',
		'get'
	).mockImplementation(
		() => Math.min(1, 544 / sourceWidth, 288 / sourceHeight) * sourceHeight
	)
	vi.mocked(getCroppedImageFile).mockResolvedValue(
		new File(['cropped'], 'image.png', { type: 'image/png' })
	)
})

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
	vi.clearAllMocks()
})

function openCropper(aspectRatio = 1) {
	const onConfirm = vi.fn()
	render(
		<ImageCropDialog
			open
			imageSrc="test-image.png"
			fileName="image.png"
			mimeType="image/png"
			aspectRatio={aspectRatio}
			onCancel={vi.fn()}
			onConfirm={onConfirm}
		/>
	)
	const image = document.querySelector('.reactEasyCrop_Image')
	if (!image) throw new Error('Cropper image was not rendered')
	fireEvent.load(image)
	return onConfirm
}

describe('image crop minimum zoom', () => {
	it.each([
		{ name: 'slightly wide logo', width: 600, height: 580 },
		{ name: 'landscape logo', width: 600, height: 300 },
		{ name: 'portrait logo', width: 300, height: 600 },
		{ name: 'square logo', width: 600, height: 600 },
	])('includes the whole $name at minimum zoom', async ({ width, height }) => {
		sourceWidth = width
		sourceHeight = height
		const onConfirm = openCropper()
		fireEvent.click(screen.getByRole('button', { name: 'Apply crop' }))
		await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce())

		const options = vi.mocked(getCroppedImageFile).mock.calls[0][0]
		const side = Math.max(width, height)
		expect(options.crop).toEqual({
			x: (width - side) / 2,
			y: (height - side) / 2,
			width: side,
			height: side,
		})
	})

	it('keeps the full portrait image inside a 16:9 selection', async () => {
		sourceWidth = 300
		sourceHeight = 600
		const onConfirm = openCropper(16 / 9)
		fireEvent.click(screen.getByRole('button', { name: 'Apply crop' }))
		await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce())

		const crop = vi.mocked(getCroppedImageFile).mock.calls[0][0].crop
		expect(crop.height).toBe(600)
		expect(crop.width).toBe(1067)
		expect(crop.x).toBe(-383)
		expect(crop.y).toBe(0)
	})

	it('can zoom in and return to the full image with the slider', async () => {
		const onConfirm = openCropper()
		const slider = screen.getByRole('slider', { hidden: true })
		fireEvent.keyDown(slider, { key: 'End' })
		expect(slider.getAttribute('aria-valuenow')).toBe('3')
		fireEvent.keyDown(slider, { key: 'Home' })
		expect(Number(slider.getAttribute('aria-valuenow'))).toBeCloseTo(580 / 600)

		fireEvent.click(screen.getByRole('button', { name: 'Apply crop' }))
		await waitFor(() => expect(onConfirm).toHaveBeenCalledOnce())
		expect(vi.mocked(getCroppedImageFile).mock.calls[0][0].crop).toEqual({
			x: 0,
			y: -10,
			width: 600,
			height: 600,
		})
	})
})
