import type { Area } from 'react-easy-crop'

const createImage = (url: string): Promise<HTMLImageElement> =>
	new Promise((resolve, reject) => {
		const image = new Image()

		image.addEventListener('load', () => resolve(image))
		image.addEventListener('error', () =>
			reject(new Error('Failed to load image'))
		)
		image.crossOrigin = 'anonymous'
		image.src = url
	})

interface getCroppedImageFileOptions {
	imageSrc: string
	crop: Area
	fileName: string
	mimeType: string
	quality?: number
}

export async function getCroppedImageFile({
	imageSrc,
	crop,
	fileName,
	mimeType,
	quality = 0.92,
}: getCroppedImageFileOptions): Promise<File> {
	const image = await createImage(imageSrc)
	const canvas = document.createElement('canvas')
	const context = canvas.getContext('2d')

	if (!context) {
		throw new Error('Failed to get canvas context')
	}

	context.drawImage(
		image,
		crop.x,
		crop.y,
		crop.width,
		crop.height,
		0,
		0,
		crop.width,
		crop.height
	)

	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (!blob) {
					reject(new Error('Failed to crop image'))
					return
				}

				resolve(new File([blob], fileName, { type: mimeType }))
			},
			mimeType,
			quality
		)
	})
}
