import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import type { ORPCRouterInputs } from '@altstack/api/routers'

import { toast } from '@altstack/ui/components/toast'

import { invalidateCatalog } from '#/utils/invalidate-catalog'
import { adminORPC, orpc } from '#/utils/orpc'

export const adminCategoryQueries = {
	list: () => adminORPC.category.list.queryOptions({ input: {} }),
	get: (input: ORPCRouterInputs['admin']['category']['getById']) =>
		adminORPC.category.getById.queryOptions({ input }),
	create: () => adminORPC.category.create.mutationOptions(),
	update: () => adminORPC.category.update.mutationOptions(),
	remove: () => adminORPC.category.remove.mutationOptions(),
}

export const useAdminCategoryList = () =>
	useSuspenseQuery(adminCategoryQueries.list())
export const useAdminCategoryGet = (
	input: ORPCRouterInputs['admin']['category']['getById']
) => useSuspenseQuery(adminCategoryQueries.get(input))

function useCategorySaved() {
	const queryClient = useQueryClient()
	const router = useRouter()
	return async () => {
		await invalidateCatalog(queryClient)
		toast.add({ type: 'success', title: 'Category saved' })
		await router.navigate({ to: '/admin/categories', replace: true })
		await router.invalidate()
	}
}

export function useAdminCategoryCreate() {
	const onSuccess = useCategorySaved()
	return useMutation({ ...adminCategoryQueries.create(), onSuccess })
}

export function useAdminCategoryUpdate() {
	const onSuccess = useCategorySaved()
	return useMutation({ ...adminCategoryQueries.update(), onSuccess })
}

export function useAdminCategoryDelete() {
	const queryClient = useQueryClient()
	const router = useRouter()
	return useMutation({
		...adminCategoryQueries.remove(),
		onSuccess: async (_, { id }) => {
			for (const queryKey of [
				adminORPC.category.getById.key({ input: { id } }),
				orpc.admin.category.getById.key({ input: { id } }),
			]) {
				await queryClient.cancelQueries({ queryKey })
				queryClient.removeQueries({ queryKey })
			}
			await invalidateCatalog(queryClient)
			toast.add({ type: 'success', title: 'Category deleted' })
			await router.navigate({ to: '/admin/categories', replace: true })
			await router.invalidate()
		},
	})
}
