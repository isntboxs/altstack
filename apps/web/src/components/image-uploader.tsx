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
	onChange?: (value: string) => void
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
	uploadingNoun: 'cover',
	sizeHint: 'PNG, JPG, GIF, or WEBP up to 3MB.',
	dialogTitle: 'Crop cover image',
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
	value,
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
		accept,
		maxSize,
		mimeTypes,
		api,
		copy,
	})

	const renderContent = () => {
		if (uploading && pendingFile) {
			return (
				<ImageDropzoneUploadingState
					file={pendingFile}
					isReplacing={Boolean(managedFile?.fileKey)}
					previewUrl={managedFile?.previewUrl}
					progress={progress}
					itemNoun={copy.uploadingNoun}
				/>
			)
		}

		if (errorMessage && !managedFile?.previewUrl) {
			return <ImageDropzoneErrorState message={errorMessage} onRetry={open} />
		}

		if (managedFile?.previewUrl) {
			return (
				<ImageDropzoneUploadedState
					isDeleting={isDeleting}
					onChange={open}
					onDelete={handleRemoveFile}
					previewUrl={managedFile.previewUrl}
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
					'gap-0 border border-dashed py-0 ring-0 transition-all duration-300 ease-in-out',
					isDragActive
						? 'border-solid border-primary bg-primary/10'
						: 'border-border hover:border-primary',
					'overflow-hidden',
					className
				)}
			>
				<CardContent className="flex size-full items-center justify-center p-0">
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

export interface LogoUploaderProps extends Omit<
	HTMLAttributes<HTMLDivElement>,
	'onChange'
> {
	value?: string
	onChange?: (value: string) => void
}

export const LogoUploader: FC<LogoUploaderProps> = ({
	className,
	...props
}) => (
	<ImageUploader
		{...props}
		aspectRatio={1}
		accept={IMAGE_ACCEPT}
		maxSize={LOGO_MAX_SIZE}
		mimeTypes={LOGO_MIME}
		api={client.admin.upload.logo}
		copy={LOGO_COPY}
		className={cn('aspect-square size-56!', className)}
	/>
)

export interface ScreenshotUploaderProps extends Omit<
	HTMLAttributes<HTMLDivElement>,
	'onChange'
> {
	value?: string
	onChange?: (value: string) => void
}

export const ScreenshotUploader: FC<ScreenshotUploaderProps> = ({
	className,
	...props
}) => (
	<ImageUploader
		{...props}
		aspectRatio={16 / 9}
		accept={IMAGE_ACCEPT}
		maxSize={SCREENSHOT_MAX_SIZE}
		mimeTypes={SCREENSHOT_MIME}
		api={client.admin.upload.screenshot}
		copy={SCREENSHOT_COPY}
		className={cn('aspect-video w-full', className)}
	/>
)
