import { cn } from 'cn'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { FC, HTMLAttributes } from 'react'
import { useDropzone } from 'react-dropzone'
import type { FileRejection } from 'react-dropzone'

import { LOGO_MIME } from '@altstack/shared/constants'

import { Card, CardContent } from '@altstack/ui/components/card'
import { toast } from '@altstack/ui/components/toast'

import { ImageCropDialog } from '#/components/image-crop-dialog'
import {
	ImageDropzoneEmptyState,
	ImageDropzoneErrorState,
	ImageDropzoneUploadedState,
	ImageDropzoneUploadingState,
} from '#/components/image-upload-state'
import { client } from '#/utils/orpc.ts'

interface ManagedLogoFile {
	fileKey: string | null
	previewUrl: string
}

interface CropSource {
	file: File
	objectUrl: string
}

interface LogoUploaderProps extends Omit<
	HTMLAttributes<HTMLDivElement>,
	'onChange'
> {
	value?: string
	onChange?: (value: string) => void
}

const revokeObjectUrl = (url?: string | null) => {
	if (url?.startsWith('blob:')) {
		URL.revokeObjectURL(url)
	}
}

type LogoMimeType = (typeof LOGO_MIME)[number]

const isLogoMimeType = (value: string): value is LogoMimeType =>
	(LOGO_MIME as ReadonlyArray<string>).includes(value)

export const LogoUploader: FC<LogoUploaderProps> = ({
	className,
	onChange,
	value,
	...props
}) => {
	const [logoFile, setLogoFile] = useState<ManagedLogoFile | null>(null)
	const [cropSource, setCropSource] = useState<CropSource | null>(null)
	const [pendingFile, setPendingFile] = useState<File | null>(null)
	const [uploading, setUploading] = useState(false)
	const [progress, setProgress] = useState(0)
	const [isDeleting, setIsDeleting] = useState(false)
	const [errorMessage, setErrorMessage] = useState<string | null>(null)
	const xhrRef = useRef<XMLHttpRequest | null>(null)
	const [prevValue, setPrevValue] = useState(value)
	const uploadAbortRef = useRef<AbortController | null>(null)
	const deleteAbortRef = useRef<AbortController | null>(null)
	const isMountedRef = useRef(true)
	const isMounted = useCallback(() => isMountedRef.current, [])

	// Kept in sync every render so the unmount cleanup below always revokes
	// whatever blob url is *currently* showing, not whatever it was on mount.
	const previewUrlRef = useRef<string | undefined>(logoFile?.previewUrl)
	const cropSourceRef = useRef<CropSource | null>(cropSource)

	useEffect(() => {
		previewUrlRef.current = logoFile?.previewUrl
	}, [logoFile?.previewUrl])

	useEffect(() => {
		cropSourceRef.current = cropSource
	}, [cropSource])

	const deleteManagedFile = useCallback(async (fileKey: string) => {
		const abortController = new AbortController()
		deleteAbortRef.current?.abort()
		deleteAbortRef.current = abortController

		try {
			await client.admin.upload.logo.remove(
				{ key: fileKey },
				{ signal: abortController.signal }
			)
		} catch (error) {
			throw new Error(
				error instanceof Error
					? error.message
					: 'Failed to delete file from storage'
			)
		}
	}, [])

	const uploadFile = useCallback(
		async (file: File) => {
			const previousLogoFile = logoFile
			const temporaryPreviewUrl = URL.createObjectURL(file)

			setLogoFile({
				fileKey: previousLogoFile?.fileKey ?? null,
				previewUrl: temporaryPreviewUrl,
			})
			setPendingFile(file)
			setUploading(true)
			setProgress(0)
			setErrorMessage(null)

			try {
				if (!isLogoMimeType(file.type)) {
					throw new Error(
						'Unsupported file type, use PNG, JPG, JPEG, GIF, or WEBP'
					)
				}

				const abortController = new AbortController()
				uploadAbortRef.current?.abort()
				uploadAbortRef.current = abortController

				const {
					key: fileKey,
					presignedUrl,
					publicUrl,
				} = await client.admin.upload.logo.request(
					{
						contentType: file.type,
						filename: file.name,
						size: file.size,
					},
					{ signal: abortController.signal }
				)

				if (!isMounted()) {
					revokeObjectUrl(temporaryPreviewUrl)
					return
				}

				await new Promise<void>((resolve, reject) => {
					const xhr = new XMLHttpRequest()
					xhrRef.current = xhr

					xhr.upload.onprogress = (event) => {
						if (event.lengthComputable) {
							const percentageComplete = (event.loaded / event.total) * 100

							setProgress(Math.round(percentageComplete))
						}
					}

					xhr.onload = () => {
						xhrRef.current = null

						if (xhr.status === 200 || xhr.status === 204) {
							resolve()
						} else {
							reject(
								new Error(
									xhr.responseText || 'Failed to upload file to object storage'
								)
							)
						}
					}

					xhr.onerror = () => {
						xhrRef.current = null
						reject(new Error('Failed to upload file to object storage'))
					}

					xhr.onabort = () => {
						xhrRef.current = null
						reject(new Error('Upload cancelled'))
					}

					xhr.open('PUT', presignedUrl)
					xhr.setRequestHeader('Content-Type', file.type)
					xhr.send(file)
				})

				// Only revoke once we know the upload actually resolved — no more
				// double-revoke on the mounted vs unmounted branches below.
				revokeObjectUrl(temporaryPreviewUrl)

				if (!isMounted()) {
					return
				}

				setLogoFile({
					fileKey,
					previewUrl: publicUrl,
				})
				setPendingFile(null)
				setUploading(false)
				setProgress(100)
				setErrorMessage(null)
				onChange?.(fileKey)

				toast.add({
					type: 'success',
					title: 'File uploaded successfully',
					description: previousLogoFile
						? 'Logo image replaced successfully'
						: 'File uploaded successfully',
				})

				if (previousLogoFile?.fileKey && previousLogoFile.fileKey !== fileKey) {
					try {
						await deleteManagedFile(previousLogoFile.fileKey)
					} catch (error) {
						toast.add({
							type: 'warning',
							title: 'Previous logo kept',
							description:
								error instanceof Error
									? error.message
									: 'The old logo could not be deleted automatically.',
						})
					}
				}
			} catch (error) {
				revokeObjectUrl(temporaryPreviewUrl)

				if (!isMounted()) {
					return
				}

				setLogoFile(previousLogoFile ?? null)
				setPendingFile(null)
				setUploading(false)
				setProgress(0)
				setErrorMessage(
					error instanceof Error ? error.message : 'Failed to upload file'
				)

				toast.add({
					type: 'error',
					title: 'Upload failed',
					description:
						error instanceof Error ? error.message : 'Failed to upload file',
				})
			}
		},
		[logoFile, deleteManagedFile, isMounted, onChange]
	)

	const onDrop = useCallback(
		(acceptedFiles: Array<File>) => {
			const file = acceptedFiles.at(0)

			if (!file) return

			// Animated GIFs get flattened to a single frame the moment they touch
			// a <canvas>, so skip the crop step for them and upload as-is.
			if (file.type === 'image/gif') {
				void uploadFile(file)
				return
			}

			const objectUrl = URL.createObjectURL(file)
			setCropSource({ file, objectUrl })
		},
		[uploadFile]
	)

	const handleCropCancel = useCallback(() => {
		setCropSource((current) => {
			if (current) {
				revokeObjectUrl(current.objectUrl)
			}
			return null
		})
	}, [])

	const handleCropConfirm = useCallback(
		(croppedFile: File) => {
			setCropSource((current) => {
				if (current) {
					revokeObjectUrl(current.objectUrl)
				}
				return null
			})
			void uploadFile(croppedFile)
		},
		[uploadFile]
	)

	const handleRemoveFile = async () => {
		if (isDeleting || uploading || !logoFile?.previewUrl) {
			return
		}

		try {
			setIsDeleting(true)
			setErrorMessage(null)

			if (logoFile.fileKey) {
				await deleteManagedFile(logoFile.fileKey)
			}

			onChange?.('')
			setLogoFile(null)
			setPendingFile(null)
			setProgress(0)
			setErrorMessage(null)

			toast.add({
				type: 'success',
				title: 'Logo image removed successfully',
				description: 'Logo image removed successfully',
			})
		} catch (error) {
			setErrorMessage(
				error instanceof Error
					? error.message
					: 'Error while deleting file, please try again'
			)

			toast.add({
				type: 'error',
				title: 'Delete logo image failed',
				description:
					error instanceof Error
						? error.message
						: 'Error while deleting file, please try again',
			})
		} finally {
			setIsDeleting(false)
		}
	}

	const rejectedFile = (fileRejection: Array<FileRejection>) => {
		if (fileRejection.length > 0) {
			const hasTooManyFiles = fileRejection.some((rejection) =>
				rejection.errors.some((error) => error.code === 'too-many-files')
			)

			const hasFileTooLarge = fileRejection.some((rejection) =>
				rejection.errors.some((error) => error.code === 'file-too-large')
			)

			const hasInvalidFileType = fileRejection.some((rejection) =>
				rejection.errors.some((error) => error.code === 'file-invalid-type')
			)

			if (hasTooManyFiles) {
				toast.add({
					type: 'error',
					title: 'Upload failed',
					description: 'Too many files selected, only 1 file is allowed',
				})
			}

			if (hasFileTooLarge) {
				toast.add({
					type: 'error',
					title: 'Upload failed',
					description: 'File size is too big, maximum file size is 3MB',
				})
			}

			if (hasInvalidFileType) {
				toast.add({
					type: 'error',
					title: 'Upload failed',
					description:
						'Unsupported file type, use PNG, JPG, JPEG, GIF, or WEBP',
				})
			}
		}
	}

	// TODO: resolve previewUrl from fileKey once the actual storage lookup exists.
	// Syncs the external `value` (fileKey) into internal state during render
	// instead of an effect to avoid cascading renders.
	if (prevValue !== value) {
		setPrevValue(value)

		if (!value) {
			setLogoFile(null)
		} else {
			setLogoFile((current) =>
				current?.fileKey === value
					? current
					: { fileKey: value, previewUrl: current?.previewUrl ?? value }
			)
		}
	}

	useEffect(() => {
		isMountedRef.current = true

		return () => {
			isMountedRef.current = false
			uploadAbortRef.current?.abort()
			deleteAbortRef.current?.abort()
			xhrRef.current?.abort()
			// Fixed: these two refs are updated every render (see the effects
			// above), so this always revokes the *current* blob url instead of
			// whatever was in state the moment the component mounted.
			revokeObjectUrl(previewUrlRef.current)
			revokeObjectUrl(cropSourceRef.current?.objectUrl)
		}
	}, [])

	const { getInputProps, getRootProps, isDragActive, open } = useDropzone({
		onDrop,
		accept: {
			'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
		},
		maxFiles: 1,
		maxSize: 3 * 1024 * 1024,
		multiple: false,
		noClick: true,
		onDropRejected: rejectedFile,
		disabled: uploading || isDeleting,
	})

	const renderContent = () => {
		if (uploading && pendingFile) {
			return (
				<ImageDropzoneUploadingState
					file={pendingFile}
					isReplacing={Boolean(logoFile?.fileKey)}
					previewUrl={logoFile?.previewUrl}
					progress={progress}
				/>
			)
		}

		if (errorMessage && !logoFile?.previewUrl) {
			return <ImageDropzoneErrorState message={errorMessage} onRetry={open} />
		}

		if (logoFile?.previewUrl) {
			return (
				<ImageDropzoneUploadedState
					isDeleting={isDeleting}
					onChange={open}
					onDelete={handleRemoveFile}
					previewUrl={logoFile.previewUrl}
				/>
			)
		}

		return (
			<ImageDropzoneEmptyState isDragActive={isDragActive} onSelect={open} />
		)
	}

	return (
		<>
			<Card
				{...getRootProps({ ...props })}
				className={cn(
					'aspect-square size-56! gap-0 border border-dashed py-0 ring-0 transition-all duration-300 ease-in-out',
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
					aspectRatio={1}
					fileName={cropSource.file.name}
					imageSrc={cropSource.objectUrl}
					mimeType={cropSource.file.type}
					onCancel={handleCropCancel}
					onConfirm={handleCropConfirm}
					open
				/>
			) : null}
		</>
	)
}
