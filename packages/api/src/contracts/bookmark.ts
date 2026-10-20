import { openapi } from '@orpc/openapi'

import { baseContract } from '@altstack/api/contracts/base'

import {
	bookmarkProjectInputSchema,
	bookmarkStateSchema,
	listBookmarkInputSchema,
	listBookmarkOutputSchema,
} from '@altstack/shared/schemas/bookmark'

export const bookmarkContract = {
	list: baseContract
		.meta(
			openapi({
				path: '/bookmarks',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				queryStyles: { page: 'primitive', limit: 'primitive' },
				summary: 'List your bookmarked published projects',
				tags: ['Bookmarks'],
				operationId: 'listMyBookmarks',
			})
		)
		.input(listBookmarkInputSchema)
		.output(listBookmarkOutputSchema),
	get: baseContract
		.meta(
			openapi({
				path: '/bookmarks/{id}',
				method: 'QUERY',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				paramsStyles: { id: 'primitive' },
				summary: 'Read your bookmark state for a published project',
				tags: ['Bookmarks'],
				operationId: 'getMyBookmark',
			})
		)
		.input(bookmarkProjectInputSchema)
		.output(bookmarkStateSchema),
	save: baseContract
		.meta(
			openapi({
				path: '/bookmarks/{id}',
				method: 'PUT',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				paramsStyles: { id: 'primitive' },
				summary: 'Save a published project to your bookmarks',
				tags: ['Bookmarks'],
				operationId: 'saveMyBookmark',
			})
		)
		.input(bookmarkProjectInputSchema)
		.output(bookmarkStateSchema),
	remove: baseContract
		.meta(
			openapi({
				path: '/bookmarks/{id}',
				method: 'DELETE',
				inputStructure: 'detailed',
				outputStructure: 'compact',
				paramsStyles: { id: 'primitive' },
				summary:
					'Remove only your bookmark, including for an unavailable project',
				tags: ['Bookmarks'],
				operationId: 'removeMyBookmark',
			})
		)
		.input(bookmarkProjectInputSchema)
		.output(bookmarkStateSchema),
}
