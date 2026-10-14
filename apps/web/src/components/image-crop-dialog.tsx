import { useCallback, useState } from 'react'
import type { FC } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point, Size } from 'react-easy-crop'

import { Button } from '@altstack/ui/components/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@altstack/ui/components/dialog'
import { Slider } from '@altstack/ui/components/slider'

import { getCroppedImageFile } from '#/utils/crop-image'

interface ImageCropDialogProps {
	open: boolean
	imageSrc: string
	fileName: string
	mimeType: string
	aspectRatio?: number
	title?: string
	description?: string
	onCancel: () => void
	onConfirm: (file: File) => void
}

export const ImageCropDialog: FC<ImageCropDialogProps> = ({
	fileName,
	imageSrc,
	mimeType,
	onCancel,
	onConfirm,
	open,
	aspectRatio = 1,
	title = 'Crop cover image',
	description = 'Drag to reposition and use the slider to zoom. The highlighted area is what gets uploaded.',
}) => {
	const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
	const [requestedZoom, setRequestedZoom] = useState<number | null>(null)
	const [mediaSize, setMediaSize] = useState<Size | null>(null)
	const [cropSize, setCropSize] = useState<Size | null>(null)
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
	const [isProcessing, setIsProcessing] = useState(false)

	// Fit the whole image inside the selection, rather than the larger panel.
	const minZoom =
		mediaSize && cropSize && mediaSize.width > 0 && mediaSize.height > 0
			? Math.min(
					cropSize.width / mediaSize.width,
					cropSize.height / mediaSize.height
				)
			: 1
	const zoom = Math.max(minZoom, requestedZoom ?? minZoom)

	const handleCropChange = useCallback(
		(nextCrop: Point) => {
			if (!mediaSize || !cropSize) return

			// Keep smaller images inside the selection and larger images covering it.
			const maxX = Math.abs(mediaSize.width * zoom - cropSize.width) / 2
			const maxY = Math.abs(mediaSize.height * zoom - cropSize.height) / 2
			setCrop({
				x: Math.max(-maxX, Math.min(maxX, nextCrop.x)),
				y: Math.max(-maxY, Math.min(maxY, nextCrop.y)),
			})
		},
		[mediaSize, cropSize, zoom]
	)

	const handleCropComplete = useCallback(
		(_croppedArea: Area, areaPixels: Area) => {
			setCroppedAreaPixels(areaPixels)
		},
		[]
	)

	const handleConfirm = async () => {
		if (!croppedAreaPixels || isProcessing) {
			return
		}

		try {
			setIsProcessing(true)

			const croppedFile = await getCroppedImageFile({
				imageSrc,
				crop: croppedAreaPixels,
				fileName,
				mimeType,
				quality: 1,
			})

			onConfirm(croppedFile)
		} catch {
			// If cropping fails for any reason, just let the user retry — the
			// source object url is still valid until onCancel/onConfirm run.
			setIsProcessing(false)
		}
	}

	return (
		<Dialog
			onOpenChange={(nextOpen) => {
				if (!nextOpen && !isProcessing) {
					onCancel()
				}
			}}
			open={open}
		>
			{/* Scaling animations distort the cropper's initial measurements. */}
			<DialogContent className="sm:max-w-xl data-open:animate-none data-closed:animate-none">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<div className="relative h-72 w-full overflow-hidden rounded-md bg-muted">
					<Cropper
						aspect={aspectRatio}
						crop={crop}
						image={imageSrc}
						minZoom={minZoom}
						onCropChange={handleCropChange}
						onCropComplete={handleCropComplete}
						onZoomChange={setRequestedZoom}
						restrictPosition={false}
						setCropSize={setCropSize}
						setMediaSize={setMediaSize}
						zoom={zoom}
					/>
				</div>

				<div className="flex items-center gap-3 px-1">
					<span className="text-sm text-muted-foreground">Zoom</span>
					<Slider
						aria-label="Zoom"
						max={3}
						min={minZoom}
						onValueChange={(next) =>
							setRequestedZoom(
								typeof next === 'number' ? next : (next[0] ?? minZoom)
							)
						}
						step={0.01}
						value={[zoom]}
					/>
				</div>

				<DialogFooter>
					<Button
						disabled={isProcessing}
						onClick={onCancel}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						disabled={isProcessing || !croppedAreaPixels}
						onClick={handleConfirm}
						type="button"
					>
						{isProcessing ? 'Processing...' : 'Apply crop'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
