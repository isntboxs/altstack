import { cn } from 'cn'
import { CloudUpload, Trash } from 'reicon-react'

import { Button } from '@altstack/ui/components/button'
import { Progress } from '@altstack/ui/components/progress'
import { Spinner } from '@altstack/ui/components/spinner'

export const ImageDropzoneEmptyState = ({
	isDragActive,
	onSelect,
	hint = 'PNG, JPG, GIF, or WEBP up to 3MB.',
}: {
	isDragActive: boolean
	onSelect: () => void
	hint?: string
}) => (
	<div className="p-6 text-center">
		<div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
			<CloudUpload
				className={cn(
					'size-5 text-muted-foreground',
					isDragActive && 'text-primary'
				)}
			/>
		</div>

		<p className="text-sm font-semibold text-muted-foreground">
			Drop your image here or{' '}
			<Button
				type="button"
				variant="link"
				size="xs"
				className="cursor-pointer px-0 font-bold"
				onClick={onSelect}
			>
				use the picker
			</Button>
		</p>

		<p className="mt-1 text-xs text-muted-foreground">{hint}</p>

		<Button
			type="button"
			variant="default"
			size="sm"
			className="mt-3"
			onClick={onSelect}
		>
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
	<div className="p-6 text-center">
		<div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-destructive/30">
			<CloudUpload className={cn('size-5 text-destructive')} />
		</div>

		<p className="text-sm font-semibold">Upload failed</p>

		<p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{message}</p>

		<Button
			type="button"
			variant="default"
			size="sm"
			className="mt-3"
			onClick={onRetry}
		>
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

		<div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-gradient-to-t from-background/90 to-transparent p-2 pt-6">
			<Button type="button" variant="secondary" size="xs" onClick={onChange}>
				Change
			</Button>

			<Button
				type="button"
				variant="destructive"
				size="icon-xs"
				aria-label="Remove logo"
				disabled={isDeleting}
				onClick={onDelete}
			>
				{isDeleting ? <Spinner /> : <Trash />}
			</Button>
		</div>
	</div>
)

export const ImageDropzoneUploadingState = ({
	previewUrl,
	progress,
	file,
	isReplacing,
	itemNoun = 'cover',
}: {
	previewUrl?: string
	progress: number
	file: File
	isReplacing: boolean
	itemNoun?: string
}) => {
	if (previewUrl) {
		return (
			<div className="relative h-full w-full">
				<img
					src={previewUrl}
					alt="Cover preview"
					className="h-full w-full object-cover"
				/>

				<div className="absolute inset-0 flex flex-col items-center justify-center bg-background/75 px-4 backdrop-blur-sm">
					<Progress value={progress} className="w-full" />
					<p className="mt-3 text-sm font-medium text-foreground">
						{isReplacing
							? `Replacing ${itemNoun}...`
							: `Uploading ${itemNoun}...`}
					</p>
					<p className="mt-1 max-w-full truncate text-xs text-muted-foreground">
						{file.name}
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="flex w-full flex-col items-center justify-center p-6 text-center">
			<Progress value={progress} className="w-full" />
			<p className="mt-2 text-sm font-medium text-foreground">Uploading...</p>
			<p className="mt-1 max-w-full truncate text-xs text-muted-foreground">
				{file.name}
			</p>
		</div>
	)
}
