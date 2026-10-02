import { useMutation, useSuspenseQuery } from '@tanstack/react-query'

import type { ProjectStatus } from '@altstack/shared'

import { toast } from '@altstack/ui/components/toast'

import { adminORPC } from '@/utils/orpc'

export const adminProjectQueries = {
	create: () =>
		adminORPC.project.create.mutationOptions({
			onError: (error) => {
				// BAD_REQUEST from a failed submit means the tmp upload keys are
				// dead — the create form handles it with a re-upload prompt.
				if (
					typeof error === 'object' &&
					'code' in error &&
					(error as { code?: unknown }).code === 'BAD_REQUEST'
				) {
					return
				}
				toast.add({
					type: 'error',
					title: 'Create Project Failed',
					description: error.message,
				})
			},
			onSuccess: () => {
				toast.add({
					type: 'success',
					title: 'Project created successfully',
					description: 'Project created successfully',
				})
			},
		}),
	list: (
		input: { page?: number; limit?: number; status?: ProjectStatus } = {}
	) => adminORPC.project.list.queryOptions({ input }),
	listCategories: () =>
		adminORPC.project.listCategories.queryOptions({ input: {} }),
}

export const useAdminProjectList = (
	input?: Parameters<typeof adminProjectQueries.list>[0]
) => useSuspenseQuery(adminProjectQueries.list(input))

export const useAdminProjectListCategories = () =>
	useSuspenseQuery(adminProjectQueries.listCategories())

export const useAdminProjectCreate = () =>
	useMutation(adminProjectQueries.create())
