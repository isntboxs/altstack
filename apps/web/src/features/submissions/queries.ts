import { useMutation, useSuspenseQuery } from '@tanstack/react-query'

import { toast } from '@altstack/ui/components/toast'

import { submissionORPC } from '#/utils/orpc'

export const submissionQueries = {
	create: () =>
		submissionORPC.create.mutationOptions({
			mutationKey: submissionORPC.create.mutationKey(),
			onSuccess: () => {
				toast.add({
					type: 'success',
					title: 'Project Submitted!',
					description: 'Your project has been submitted for review.',
				})
			},
			onError: (error) => {
				toast.add({
					type: 'error',
					title: 'Submission Failed',
					description:
						error instanceof Error ? error.message : 'Failed to submit project',
					priority: 'high',
				})
			},
		}),

	list: () => submissionORPC.list.queryOptions(),
}

export const useCreateSubmission = () => useMutation(submissionQueries.create())

export const useListSubmissions = () =>
	useSuspenseQuery(submissionQueries.list())
