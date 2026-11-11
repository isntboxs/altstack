import type { RefObject } from 'react'

import { requestContentImageUploadInputSchema } from '@altstack/shared/schemas/upload'

import { toast } from '@altstack/ui/components/toast'

export async function uploadContentImage(file: File, projectId?: string) {
	const parsed = requestContentImageUploadInputSchema.safeParse({
		body: {
			filename: file.name.slice(0, 100),
			contentType: file.type,
			size: file.size,
			projectId,
		},
	})
	if (!parsed.success) {
		throw new Error('Choose a PNG, JPEG, WebP or GIF image up to 5 MB.')
	}

	const { client } = await import('#/utils/orpc')
	const { key, presignedUrl } = await client.contentImageUpload.request(
		parsed.data
	)
	const response = await fetch(presignedUrl, {
		method: 'PUT',
		body: file,
		headers: { 'Content-Type': parsed.data.body.contentType },
	})
	if (!response.ok) {
		throw new Error('Image upload failed. Please try again.')
	}
	const { url } = await client.contentImageUpload.complete({
		body: { key, projectId },
	})
	return url
}

export async function uploadEditorImage(
	file: File,
	projectId: string | undefined,
	pendingUploads: RefObject<number>
) {
	pendingUploads.current += 1
	try {
		return await uploadContentImage(file, projectId)
	} catch (error) {
		toast.add({
			type: 'error',
			title: 'Could not upload image',
			description: error instanceof Error ? error.message : 'Please try again.',
		})
		throw error
	} finally {
		pendingUploads.current -= 1
	}
}

export function canSaveEditorContent(
	editor: { isUploading?: () => boolean } | null
) {
	if (!editor?.isUploading?.()) return true
	toast.add({
		type: 'error',
		title: 'Image upload in progress',
		description: 'Wait for the image upload to finish before saving.',
	})
	return false
}
