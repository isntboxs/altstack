import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import type { FileRejection } from 'react-dropzone'

import type { ORPCRouterClient } from '@altstack/api/routers'

import type { LOGO_MIME } from '@altstack/shared/constants'

import { toast } from '@altstack/ui/components/toast'

export type ImageUploadEndpoints =
	| ORPCRouterClient['admin']['upload']['logo']
	| ORPCRouterClient['admin']['upload']['screenshot']

export interface ImageUploadCopy {
	noun: string
	uploadingNoun: string
	sizeHint: string
	dialogTitle: string
	dialogDescription: string
}

export interface UseImageUploadOptions {
	value?: string
	onChange?: (value: string) => void
	accept: Record<string, Array<string>>
	maxSize: number
	mimeTypes: ReadonlyArray<string>
	api: ImageUploadEndpoints
	copy: ImageUploadCopy
}

export interface ManagedImageFile {
	fileKey: string | null
	previewUrl: string
}

export interface CropSource {
	file: File
	objectUrl: string
}

// LOGO_MIME and SCREENSHOT_MIME hold the same values, so a single
// constituent covers both upload kinds.
type SupportedImageMime = (typeof LOGO_MIME)[number]

const revokeObjectUrl = (url?: string | null) => {
	if (url?.startsWith('blob:')) {
		URL.revokeObjectURL(url)
	}
}

const isSupportedImageMime = (
	mimeTypes: ReadonlyArray<string>,
	value: string
): value is SupportedImageMime => mimeTypes.includes(value)

export const useImageUpload = ({
	value,
	onChange,
	accept,
	maxSize,
	mimeTypes,
	api,
	copy,
}: UseImageUploadOptions) => {
	const [managedFile, setManagedFile] = useState<ManagedImageFile | null>(null)
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
	const previewUrlRef = useRef<string | undefined>(managedFile?.previewUrl)
	const cropSourceRef = useRef<CropSource | null>(cropSource)

	useEffect(() => {
		previewUrlRef.current = managedFile?.previewUrl
	}, [managedFile?.previewUrl])

	useEffect(() => {
		cropSourceRef.current = cropSource
	}, [cropSource])

	const deleteManagedFile = useCallback(
		async (fileKey: string) => {
			const abortController = new AbortController()
			deleteAbortRef.current?.abort()
			deleteAbortRef.current = abortController

			try {
				await api.remove({ key: fileKey }, { signal: abortController.signal })
			} catch (error) {
				throw new Error(
					error instanceof Error
						? error.message
						: 'Failed to delete file from storage'
				)
			}
		},
		[api]
	)

	const uploadFile = useCallback(
		async (
			file: File
		): Promise<{ fileKey: string; publicUrl: string } | null> => {
			if (!isSupportedImageMime(mimeTypes, file.type)) {
				throw new Error(
					'Unsupported file type, use PNG, JPG, JPEG, GIF, or WEBP'
				)
			}

			const abortController = new AbortController()
			uploadAbortRef.current?.abort()
			uploadAbortRef.current = abortController

			setUploading(true)
			setProgress(0)
			setErrorMessage(null)

			try {
				const {
					key: fileKey,
					presignedUrl,
					publicUrl,
				} = await api.request(
					{
						contentType: file.type,
						filename: file.name,
						size: file.size,
					},
					{ signal: abortController.signal }
				)

				if (!isMounted()) {
					return null
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

				if (!isMounted()) {
					return null
				}

				return { fileKey, publicUrl }
			} catch (error) {
				if (!isMounted()) {
					return null
				}

				throw error
			}
		},
		[api, isMounted, mimeTypes]
	)

	const submitUpload = useCallback(
		async (file: File, previousFile: ManagedImageFile | null) => {
			const temporaryPreviewUrl = URL.createObjectURL(file)

			setManagedFile({
				fileKey: previousFile?.fileKey ?? null,
				previewUrl: temporaryPreviewUrl,
			})
			setPendingFile(file)

			try {
				const uploaded = await uploadFile(file)

				if (!uploaded) {
					revokeObjectUrl(temporaryPreviewUrl)
					return
				}

				// Only revoke once we know the upload actually resolved — no more
				// double-revoke on the mounted vs unmounted branches below.
				revokeObjectUrl(temporaryPreviewUrl)

				if (!isMounted()) {
					return
				}

				setManagedFile({
					fileKey: uploaded.fileKey,
					previewUrl: uploaded.publicUrl,
				})
				setPendingFile(null)
				setUploading(false)
				setProgress(100)
				setErrorMessage(null)
				onChange?.(uploaded.fileKey)

				return uploaded
			} catch (error) {
				revokeObjectUrl(temporaryPreviewUrl)

				if (!isMounted()) {
					return
				}

				setManagedFile(previousFile ?? null)
				setPendingFile(null)
				setUploading(false)
				setProgress(0)
				setErrorMessage(
					error instanceof Error ? error.message : 'Failed to upload file'
				)

				throw error
			}
		},
		[uploadFile, isMounted, onChange]
	)

	const notifyUploadFailed = useCallback((error: unknown) => {
		toast.add({
			type: 'error',
			title: 'Upload failed',
			description:
				error instanceof Error ? error.message : 'Failed to upload file',
		})
	}, [])

	const handleNewImage = useCallback(
		async (file: File) => {
			try {
				const uploaded = await submitUpload(file, managedFile)

				if (!uploaded) return

				toast.add({
					type: 'success',
					title: 'File uploaded successfully',
					description: 'File uploaded successfully',
				})
			} catch (error) {
				notifyUploadFailed(error)
			}
		},
		[managedFile, submitUpload, notifyUploadFailed]
	)

	const handleChangedImage = useCallback(
		async (file: File) => {
			const previousFile = managedFile

			try {
				const uploaded = await submitUpload(file, previousFile)

				if (!uploaded) return

				toast.add({
					type: 'success',
					title: 'File uploaded successfully',
					description: `${copy.noun} image replaced successfully`,
				})

				if (
					previousFile?.fileKey &&
					previousFile.fileKey !== uploaded.fileKey
				) {
					try {
						await api.change({
							oldKey: previousFile.fileKey,
							newKey: uploaded.fileKey,
						})
					} catch (error) {
						toast.add({
							type: 'warning',
							title: `Previous ${copy.noun.toLowerCase()} kept`,
							description:
								error instanceof Error
									? error.message
									: 'The old image could not be deleted automatically.',
						})
					}
				}
			} catch (error) {
				notifyUploadFailed(error)
			}
		},
		[api, copy.noun, managedFile, submitUpload, notifyUploadFailed]
	)

	const onDrop = useCallback(
		(acceptedFiles: Array<File>) => {
			const file = acceptedFiles.at(0)

			if (!file) return

			const submitImage = managedFile?.fileKey
				? handleChangedImage
				: handleNewImage

			// Animated GIFs get flattened to a single frame the moment they touch
			// a <canvas>, so skip the crop step for them and upload as-is.
			if (file.type === 'image/gif') {
				void submitImage(file)
				return
			}

			const objectUrl = URL.createObjectURL(file)
			setCropSource({ file, objectUrl })
		},
		[managedFile, handleChangedImage, handleNewImage]
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
			if (managedFile?.fileKey) {
				void handleChangedImage(croppedFile)
			} else {
				void handleNewImage(croppedFile)
			}
		},
		[managedFile, handleChangedImage, handleNewImage]
	)

	const handleRemoveFile = async () => {
		if (isDeleting || uploading || !managedFile?.previewUrl) {
			return
		}

		try {
			setIsDeleting(true)
			setErrorMessage(null)

			if (managedFile.fileKey) {
				await deleteManagedFile(managedFile.fileKey)
			}

			onChange?.('')
			setManagedFile(null)
			setPendingFile(null)
			setProgress(0)
			setErrorMessage(null)

			toast.add({
				type: 'success',
				title: `${copy.noun} image removed successfully`,
				description: `${copy.noun} image removed successfully`,
			})
		} catch (error) {
			setErrorMessage(
				error instanceof Error
					? error.message
					: 'Error while deleting file, please try again'
			)

			toast.add({
				type: 'error',
				title: `Delete ${copy.noun.toLowerCase()} image failed`,
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
					description: `File size is too big, maximum file size is ${Math.round(maxSize / 1024 / 1024)}MB`,
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
			setManagedFile(null)
		} else {
			setManagedFile((current) =>
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
		accept,
		maxFiles: 1,
		maxSize,
		multiple: false,
		noClick: true,
		onDropRejected: rejectedFile,
		disabled: uploading || isDeleting,
	})

	return {
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
	}
}
