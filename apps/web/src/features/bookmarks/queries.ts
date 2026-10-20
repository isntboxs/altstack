import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { ORPCRouterInputs } from '@altstack/api/routers'

import { toast } from '@altstack/ui/components/toast'

import { client, orpc } from '#/utils/orpc'

const accountKey = (userId: string | undefined) =>
	['bookmarks', userId] as const
const stateKey = (id: string, userId: string | undefined) =>
	[...accountKey(userId), 'state', id] as const
const listKey = (userId: string | undefined) =>
	[...accountKey(userId), 'list'] as const

export const bookmarkQueries = {
	state: (id: string, userId: string) =>
		orpc.bookmark.get.queryOptions({
			input: { params: { id } },
			queryKey: stateKey(id, userId),
			retry: false,
			staleTime: 0,
			gcTime: 0,
		}),
	list: (
		query: ORPCRouterInputs['bookmark']['list']['query'],
		userId: string
	) =>
		orpc.bookmark.list.queryOptions({
			input: { query },
			queryKey: [...listKey(userId), query],
			retry: false,
			staleTime: 0,
			gcTime: 0,
		}),
}

export function useBookmarkMutation(id: string, userId: string | undefined) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationKey: [...accountKey(userId), 'change', id],
		scope: { id: `bookmark:${userId}:${id}` },
		mutationFn: async (saved: boolean) => {
			if (!userId) throw new Error('Sign in to manage your bookmarks.')
			const input = { params: { id } }
			return saved ? client.bookmark.save(input) : client.bookmark.remove(input)
		},
		retry: false,
		onSuccess: async (state) => {
			// A read started before this mutation must not overwrite the saved state.
			await queryClient.cancelQueries({ queryKey: stateKey(id, userId) })
			queryClient.setQueryData(stateKey(id, userId), state)
			toast.add({
				type: 'success',
				title: state.bookmarked ? 'Project bookmarked' : 'Bookmark removed',
			})
			await queryClient.invalidateQueries({ queryKey: listKey(userId) })
		},
		onError: () => {
			toast.add({
				type: 'error',
				title: 'Unable to update bookmark',
				description: 'Please try again.',
			})
			void queryClient.invalidateQueries({ queryKey: stateKey(id, userId) })
		},
	})
}
