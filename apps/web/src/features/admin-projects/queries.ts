import {
	useInfiniteQuery,
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import type { ORPCRouterInputs } from '@altstack/api/routers'

import { toast } from '@altstack/ui/components/toast'

import { invalidateCatalog } from '#/utils/invalidate-catalog'
import { adminORPC } from '@/utils/orpc'

export const adminProjectQueries = {
	githubReadme: () => adminORPC.project.githubReadme.mutationOptions(),
	githubMetadata: () => adminORPC.project.githubMetadata.mutationOptions(),
	create: () => adminORPC.project.create.mutationOptions(),
	update: () => adminORPC.project.update.mutationOptions(),
	delete: () => adminORPC.project.remove.mutationOptions(),
	list: (input: ORPCRouterInputs['admin']['project']['list']['query'] = {}) =>
		adminORPC.project.list.queryOptions({ input: { query: input } }),
	listCategories: () =>
		adminORPC.project.listCategories.queryOptions({ input: {} }),
	get: (input: { id: string }) =>
		adminORPC.project.getById.queryOptions({ input: { params: input } }),
	reviewHistory: (input: { id: string }) =>
		adminORPC.project.reviewHistory.infiniteOptions({
			input: (page: number) => {
				return { params: input, query: { page, limit: 20 } }
			},
			initialPageParam: 1,
			getNextPageParam: (lastPage) =>
				lastPage.pagination.hasNextPage
					? lastPage.pagination.page + 1
					: undefined,
		}),
}

// An imperative read: fetching happens only when the admin clicks the button.
export const useAdminProjectGithubReadme = () =>
	useMutation({ ...adminProjectQueries.githubReadme(), retry: false })

export const useAdminProjectGithubMetadata = () =>
	useMutation({ ...adminProjectQueries.githubMetadata(), retry: false })

export const useAdminProjectReviewHistory = (input: { id: string }) =>
	useInfiniteQuery(adminProjectQueries.reviewHistory(input))

export const useAdminProjectList = (
	input?: Parameters<typeof adminProjectQueries.list>[0]
) => useSuspenseQuery(adminProjectQueries.list(input))

export const useAdminProjectListCategories = () =>
	useSuspenseQuery(adminProjectQueries.listCategories())

export const useAdminProjectCreate = () => {
	const queryClient = useQueryClient()
	const router = useRouter()

	return useMutation({
		...adminProjectQueries.create(),
		onError: (error) => {
			// UPLOAD_EXPIRED / CONFLICT_AFTER_PROMOTE / UPLOAD_CONSUMED
			// from a failed submit means the tmp upload keys are dead —
			// the create form handles those with a re-upload prompt.
			// Preflight CONFLICT and plain BAD_REQUEST (validation) keep
			// the normal error toast and preserve the uploaded images.
			if (
				typeof error === 'object' &&
				'code' in error &&
				((error as { code?: unknown }).code === 'UPLOAD_EXPIRED' ||
					(error as { code?: unknown }).code === 'CONFLICT_AFTER_PROMOTE' ||
					(error as { code?: unknown }).code === 'UPLOAD_CONSUMED')
			) {
				return
			}
			toast.add({
				type: 'error',
				title: 'Create Project Failed',
				description: error.message,
			})
		},
		onSuccess: async () => {
			toast.add({
				type: 'success',
				title: 'Project created successfully',
				description: 'Project created successfully',
			})

			await invalidateCatalog(queryClient)

			await router.navigate({
				to: '/projects',
				replace: true,
				viewTransition: true,
			})
			await router.invalidate()
		},
	})
}

export const useAdminProjectUpdate = () => {
	const queryClient = useQueryClient()
	const router = useRouter()

	return useMutation({
		...adminProjectQueries.update(),
		onError: (error) => {
			// UPLOAD_EXPIRED / CONFLICT_AFTER_PROMOTE / UPLOAD_CONSUMED
			// from a failed submit means the tmp upload keys are dead —
			// the create form handles those with a re-upload prompt.
			// Preflight CONFLICT and plain BAD_REQUEST (validation) keep
			// the normal error toast and preserve the uploaded images.
			if (
				typeof error === 'object' &&
				'code' in error &&
				((error as { code?: unknown }).code === 'UPLOAD_EXPIRED' ||
					(error as { code?: unknown }).code === 'CONFLICT_AFTER_PROMOTE' ||
					(error as { code?: unknown }).code === 'UPLOAD_CONSUMED')
			) {
				return
			}

			toast.add({
				type: 'error',
				title: 'Update Project Failed',
				description: error.message,
			})
		},
		onSuccess: async (updated, variables) => {
			toast.add({
				type: 'success',
				title: 'Project updated successfully',
				description: 'Project updated successfully',
			})

			queryClient.setQueryData(
				adminProjectQueries.get({ id: variables.params.id }).queryKey,
				updated
			)
			await invalidateCatalog(queryClient)
			await router.invalidate()
		},
	})
}

export const useAdminProjectDelete = () => {
	const queryClient = useQueryClient()
	const router = useRouter()

	return useMutation({
		...adminProjectQueries.delete(),
		onSuccess: async (_, variables) => {
			toast.add({
				type: 'success',
				title: 'Project deleted successfully',
				description: 'Project deleted successfully',
			})

			queryClient.removeQueries({
				queryKey: adminProjectQueries.get({ id: variables.params.id }).queryKey,
			})

			await invalidateCatalog(queryClient)

			await router.invalidate()
		},
		onError: (error) => {
			toast.add({
				type: 'error',
				title: 'Delete Project Failed',
				description: error.message,
			})
		},
	})
}

export const useAdminProjectGet = (input: { id: string }) =>
	useSuspenseQuery(adminProjectQueries.get(input))
