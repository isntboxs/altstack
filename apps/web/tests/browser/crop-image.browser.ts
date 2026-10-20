import { describe, expect, it } from 'vite-plus/test'

import { getCroppedImageFile } from '#/utils/crop-image'

function createSourceImage() {
	const canvas = document.createElement('canvas')
	canvas.width = 64
	canvas.height = 32
	const context = canvas.getContext('2d')!
	context.fillStyle = '#ff0000'
	context.fillRect(0, 0, 32, 32)
	context.fillStyle = '#0000ff'
	context.fillRect(32, 0, 32, 32)
	return canvas.toDataURL('image/png')
}

async function readImage(file: File) {
	const image = await createImageBitmap(file)
	try {
		const canvas = document.createElement('canvas')
		canvas.width = image.width
		canvas.height = image.height
		const context = canvas.getContext('2d')!
		context.drawImage(image, 0, 0)
		return context.getImageData(0, 0, image.width, image.height)
	} finally {
		image.close()
	}
}

describe('image cropping in Chromium', () => {
	it('exports the selected pixels as a decodable PNG file', async () => {
		const file = await getCroppedImageFile({
			imageSrc: createSourceImage(),
			crop: { x: 32, y: 0, width: 32, height: 32 },
			fileName: 'cropped.png',
			mimeType: 'image/png',
		})

		expect(file).toBeInstanceOf(File)
		expect(file.name).toBe('cropped.png')
		expect(file.type).toBe('image/png')
		const image = await readImage(file)
		expect([image.width, image.height]).toEqual([32, 32])
		expect(Array.from(image.data.slice(0, 4))).toEqual([0, 0, 255, 255])
	})

	it.each([
		{ mimeType: 'image/png', extension: 'png', padding: [0, 0, 0, 0] },
		{ mimeType: 'image/jpeg', extension: 'jpg', padding: [255, 255, 255, 255] },
	])(
		'preserves padding outside the source for $mimeType',
		async ({ mimeType, extension, padding }) => {
			const file = await getCroppedImageFile({
				imageSrc: createSourceImage(),
				crop: { x: -16, y: -16, width: 96, height: 64 },
				fileName: `padded.${extension}`,
				mimeType,
				quality: 1,
			})

			expect(file.type).toBe(mimeType)
			const image = await readImage(file)
			expect([image.width, image.height]).toEqual([96, 64])
			expect(Array.from(image.data.slice(0, 4))).toEqual(padding)
		}
	)
})
