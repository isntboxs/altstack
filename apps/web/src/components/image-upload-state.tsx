import { cn } from 'cn'
import { CloudUpload, Trash } from 'reicon-react'

import { Button } from '@altstack/ui/components/button'
import { Progress } from '@altstack/ui/components/progress'
import { Spinner } from '@altstack/ui/components/spinner'

export const ImageDropzoneEmptyState = ({
	isDragActive,
	onSelect,
}: {
	isDragActive: boolean
	onSelect: () => void
}) => (
	<div className="text-center">
		<div className="mx-auto mb-4 flex size-12 items-center justify-center bg-muted">
			<CloudUpload
				className={cn(
					'size-6 text-muted-foreground',
					isDragActive && 'text-primary'
				)}
			/>
		</div>

		<p className="text-base font-semibold text-muted-foreground">
			Drop your image here or{' '}
			<Button
				type="button"
				className="cursor-pointer font-bold text-primary"
				onClick={onSelect}
			>
				use the picker
			</Button>
		</p>

		<p className="mt-1 text-xs text-muted-foreground">
			PNG, JPG, GIF, or WEBP up to 5MB.
		</p>

		<Button type="button" variant="default" className="mt-4" onClick={onSelect}>
			Select File
		</Button>
	</div>
)

export const ImageDropzoneErrorState = ({
	message,
	onRetry,
}: {
	message: string
	onRetry: () => void
}) => (
	<div className="text-center">
		<div className="mx-auto mb-4 flex size-12 items-center justify-center bg-destructive/30">
			<CloudUpload className={cn('size-6 text-destructive')} />
		</div>

		<p className="text-base font-semibold">Upload failed</p>

		<p className="mt-1 text-xs text-muted-foreground">{message}</p>

		<Button type="button" variant="default" className="mt-4" onClick={onRetry}>
			Retry File Selection
		</Button>
	</div>
)

export const ImageDropzoneUploadedState = ({
	onChange,
	previewUrl,
	isDeleting,
	onDelete,
}: {
	onChange: () => void
	previewUrl: string
	isDeleting: boolean
	onDelete: () => void
}) => (
	<div className="relative h-full w-full">
		<img
			src={previewUrl}
			alt="Preview"
			className="h-full w-full object-cover"
		/>

		<div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-background/85 p-4 backdrop-blur-sm">
			<p className="text-left text-xs text-foreground/80">
				Drag and drop another image here to replace the current cover.
			</p>

			<div className="flex shrink-0 items-center gap-2">
				<Button type="button" variant="secondary" onClick={onChange}>
					Change cover
				</Button>

				<Button
					type="button"
					variant="destructive"
					disabled={isDeleting}
					onClick={onDelete}
				>
					{isDeleting ? <Spinner /> : <Trash />}
					Remove
				</Button>
			</div>
		</div>
	</div>
)

export const ImageDropzoneUploadingState = ({
	previewUrl,
	progress,
	file,
	isReplacing,
}: {
	previewUrl?: string
	progress: number
	file: File
	isReplacing: boolean
}) => {
	if (previewUrl) {
		return (
			<div className="relative h-full w-full">
				<img
					src={previewUrl}
					alt="Cover preview"
					className="h-full w-full object-cover"
				/>

				<div className="absolute inset-0 flex flex-col items-center justify-center bg-background/75 px-6 backdrop-blur-sm">
					<Progress value={progress} className="w-full max-w-sm" />
					<p className="mt-3 font-medium text-foreground">
						{isReplacing ? 'Replacing cover...' : 'Uploading cover...'}
					</p>
					<p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">
						{file.name}
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col items-center justify-center">
			<Progress value={progress} className="w-full" />
			<p className="mt-2 font-medium text-foreground">Uploading...</p>
			<p className="mt-1 max-w-xs truncate text-xs text-muted-foreground">
				{file.name}
			</p>
		</div>
	)
}
