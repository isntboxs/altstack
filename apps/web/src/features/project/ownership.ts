import { queryOptions } from '@tanstack/react-query'

import type { ImageUploadEndpoints } from '#/components/use-image-upload'
import { client } from '#/utils/orpc'

export const ownershipKey = ['ownership'] as const
export const ownershipQueries = {
	github: (userId: string, id: string) =>
		queryOptions({
			queryKey: [...ownershipKey, 'github', id, userId],
			queryFn: () => client.ownership.github({ params: { id } }),
			staleTime: 60000,
			refetchOnWindowFocus: false,
			retry: false,
		}),
	state: (userId: string | undefined, id: string) =>
		queryOptions({
			queryKey: [...ownershipKey, 'state', id, userId],
			queryFn: () => client.ownership.state({ params: { id } }),
		}),
	list: (userId: string, page = 1) =>
		queryOptions({
			queryKey: [...ownershipKey, 'list', userId, page],
			queryFn: () => client.ownership.list({ query: { page, limit: 25 } }),
		}),
	inbox: (userId: string, page = 1) =>
		queryOptions({
			queryKey: [...ownershipKey, 'inbox', userId, page],
			queryFn: () => client.ownership.inbox({ query: { page, limit: 25 } }),
		}),
	project: (userId: string, id: string) =>
		queryOptions({
			queryKey: [...ownershipKey, 'project', userId, id],
			queryFn: () => client.ownership.get({ params: { id } }),
		}),
	categories: (userId: string, id: string) =>
		queryOptions({
			queryKey: [...ownershipKey, 'categories', userId, id],
			queryFn: () => client.ownership.categories({ params: { id } }),
		}),
}

export function memberUploadApi(
	id: string,
	kind: 'logo' | 'screenshot'
): ImageUploadEndpoints {
	return {
		request: ({ body }) =>
			client.ownership.upload({ params: { id }, body: { ...body, kind } }),
		remove: ({ body }) =>
			client.ownership.removeUpload({ params: { id }, body }),
		change: ({ body }) =>
			client.ownership.removeUpload({
				params: { id },
				body: { key: body.oldKey },
			}),
	}
}
