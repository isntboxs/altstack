import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { ORPCRouterInputs } from '@altstack/api/routers'

import { toast } from '@altstack/ui/components/toast'

import { adminORPC } from '#/utils/orpc'

export const adminReportQueries = {
	list: (query: ORPCRouterInputs['admin']['report']['list']['query'] = {}) =>
		adminORPC.report.list.queryOptions({ input: { query } }),
}

export const useAdminReportList = (
	query: ORPCRouterInputs['admin']['report']['list']['query']
) => useQuery({ ...adminReportQueries.list(query), retry: false })

export function useAdminReportModerate() {
	const queryClient = useQueryClient()
	return useMutation({
		...adminORPC.report.moderate.mutationOptions(),
		retry: false,
		onSuccess: (report) => {
			toast.add({
				type: 'success',
				title:
					report.status === 'resolved' ? 'Report resolved' : 'Report dismissed',
			})
		},
		onError: (error) => {
			toast.add({
				type: 'error',
				title: 'Unable to update report',
				description:
					'code' in error && error.code === 'CONFLICT'
						? 'Another admin has already reviewed this report. The inbox has been refreshed.'
						: 'Refresh the inbox before trying again.',
			})
		},
		// Also refresh on conflict or a lost response: the decision may have committed.
		onSettled: async () => {
			await queryClient.invalidateQueries({
				queryKey: adminORPC.report.list.key(),
			})
		},
	})
}
