import { cn } from 'cn'
import type { FC, HTMLAttributes } from 'react'

import {
	LOGO_MAX_SIZE,
	LOGO_MIME,
	SCREENSHOT_MAX_SIZE,
	SCREENSHOT_MIME,
} from '@altstack/shared/constants'

import { Card, CardContent } from '@altstack/ui/components/card'

import { ImageCropDialog } from '#/components/image-crop-dialog'
import {
	ImageDropzoneEmptyState,
	ImageDropzoneErrorState,
	ImageDropzoneUploadedState,
	ImageDropzoneUploadingState,
} from '#/components/image-upload-state'
import type {
	ImageUploadCopy,
	ImageUploadEndpoints,
} from '#/components/use-image-upload'
import { useImageUpload } from '#/components/use-image-upload'
import { client } from '#/utils/orpc.ts'

interface ImageUploaderProps extends Omit<
	HTMLAttributes<HTMLDivElement>,
	'onChange'
> {
	value?: string
	// Persisted assets stay outside temporary-upload storage operations.
	existingUrl?: string | null
	onRemoveExisting?: () => void
	onChange?: (value: string) => void
	onDisplayUrlChange?: (url: string | null) => void
	aspectRatio: number
	accept: Record<string, Array<string>>
	maxSize: number
	mimeTypes: ReadonlyArray<string>
	api: ImageUploadEndpoints
	copy: ImageUploadCopy
}

const IMAGE_ACCEPT = {
	'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
}

const LOGO_COPY: ImageUploadCopy = {
	noun: 'Logo',
	uploadingNoun: 'logo',
	sizeHint: 'PNG, JPG, GIF, or WEBP up to 3MB.',
	dialogTitle: 'Crop logo image',
	dialogDescription:
		'Drag to reposition and use the slider to zoom. The highlighted area is what gets uploaded.',
}

const SCREENSHOT_COPY: ImageUploadCopy = {
	noun: 'Screenshot',
	uploadingNoun: 'screenshot',
	sizeHint: 'PNG, JPG, GIF, or WEBP up to 5MB.',
	dialogTitle: 'Crop screenshot image',
	dialogDescription:
		'Drag to reposition and use the slider to zoom. The highlighted area is what gets uploaded.',
}

export const ImageUploader: FC<ImageUploaderProps> = ({
	className,
	onChange,
	onDisplayUrlChange,
	value,
	existingUrl,
	onRemoveExisting,
	aspectRatio,
	accept,
	maxSize,
	mimeTypes,
	api,
	copy,
	...props
}) => {
	const {
		managedFile,
		cropSource,
		pendingFile,
		uploading,
		progress,
		isDeleting,
		errorMessage,
		dropzone: { getRootProps, getInputProps, isDragActive, open },
		handleCropCancel,
		handleCropConfirm,
		handleRemoveFile,
	} = useImageUpload({
		value,
		onChange,
		onDisplayUrlChange,
		accept,
		maxSize,
		mimeTypes,
		api,
		copy,
	})
	const previewUrl = managedFile?.previewUrl ?? existingUrl

	const renderContent = () => {
		if (uploading && pendingFile) {
			return (
				<ImageDropzoneUploadingState
					file={pendingFile}
					isReplacing={Boolean(managedFile?.fileKey ?? existingUrl)}
					previewUrl={previewUrl ?? undefined}
					progress={progress}
					itemNoun={copy.uploadingNoun}
				/>
			)
		}

		if (errorMessage && !previewUrl) {
			return <ImageDropzoneErrorState message={errorMessage} onRetry={open} />
		}

		if (previewUrl) {
			return (
				<ImageDropzoneUploadedState
					isDeleting={isDeleting}
					onChange={open}
					onDelete={
						managedFile?.previewUrl ? handleRemoveFile : onRemoveExisting
					}
					previewUrl={previewUrl}
					itemNoun={copy.noun.toLowerCase()}
					contain={aspectRatio === 1}
				/>
			)
		}

		return (
			<ImageDropzoneEmptyState
				isDragActive={isDragActive}
				onSelect={open}
				hint={copy.sizeHint}
			/>
		)
	}

	return (
		<>
			<Card
				{...getRootProps({ ...props })}
				className={cn(
					'relative gap-0 border border-dashed py-0 ring-0 transition-all duration-300 ease-in-out',
					isDragActive
						? 'border-solid border-primary bg-primary/10'
						: 'border-border hover:border-primary',
					'overflow-hidden',
					!previewUrl && 'min-h-56',
					className
				)}
			>
				<CardContent className="absolute inset-0 flex items-center justify-center p-0">
					<input {...getInputProps()} />
					{renderContent()}
				</CardContent>
			</Card>

			{cropSource ? (
				<ImageCropDialog
					aspectRatio={aspectRatio}
					fileName={cropSource.file.name}
					imageSrc={cropSource.objectUrl}
					mimeType={cropSource.file.type}
					title={copy.dialogTitle}
					description={copy.dialogDescription}
					onCancel={handleCropCancel}
					onConfirm={handleCropConfirm}
					open
				/>
			) : null}
		</>
	)
}

export type LogoUploaderProps = Pick<
	ImageUploaderProps,
	| 'value'
	| 'existingUrl'
	| 'onRemoveExisting'
	| 'onChange'
	| 'onDisplayUrlChange'
> &
	Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & {
		api?: ImageUploadEndpoints
	}

export const LogoUploader: FC<LogoUploaderProps> = ({
	className,
	api = client.admin.upload.logo,
	...props
}) => (
	<ImageUploader
		{...props}
		aspectRatio={1}
		accept={IMAGE_ACCEPT}
		maxSize={LOGO_MAX_SIZE}
		mimeTypes={LOGO_MIME}
		api={api}
		copy={LOGO_COPY}
		className={cn('aspect-square w-full max-w-56', className)}
	/>
)

export type ScreenshotUploaderProps = LogoUploaderProps

export const ScreenshotUploader: FC<ScreenshotUploaderProps> = ({
	className,
	api = client.admin.upload.screenshot,
	...props
}) => (
	<ImageUploader
		{...props}
		aspectRatio={16 / 9}
		accept={IMAGE_ACCEPT}
		maxSize={SCREENSHOT_MAX_SIZE}
		mimeTypes={SCREENSHOT_MIME}
		api={api}
		copy={SCREENSHOT_COPY}
		className={cn('aspect-video w-full', className)}
	/>
)
