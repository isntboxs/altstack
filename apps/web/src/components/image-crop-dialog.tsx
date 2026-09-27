import { useCallback, useState } from 'react'
import type { FC } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'

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
}) => {
	const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
	const [zoom, setZoom] = useState(1)
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
	const [isProcessing, setIsProcessing] = useState(false)

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
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Crop cover image</DialogTitle>
					<DialogDescription>
						Drag to reposition and use the slider to zoom. The highlighted area
						is what gets uploaded.
					</DialogDescription>
				</DialogHeader>

				<div className="relative h-72 w-full overflow-hidden rounded-md bg-muted">
					<Cropper
						aspect={aspectRatio}
						crop={crop}
						image={imageSrc}
						onCropChange={setCrop}
						onCropComplete={handleCropComplete}
						onZoomChange={setZoom}
						zoom={zoom}
					/>
				</div>

				<div className="flex items-center gap-3 px-1">
					<span className="text-sm text-muted-foreground">Zoom</span>
					<Slider
						max={3}
						min={1}
						onValueChange={(next) =>
							setZoom(typeof next === 'number' ? next : (next[0] ?? 1))
						}
						step={0.1}
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
