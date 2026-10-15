import type { ORPCRouterInputs } from '@altstack/api/routers'

import { orpc } from '#/utils/orpc'

export const submissionQueries = {
	getById: (id: string, userId: string) =>
		orpc.submission.getById.queryOptions({
			input: { params: { id } },
			queryKey: [
				...orpc.submission.getById.queryKey({ input: { params: { id } } }),
				{ userId },
			],
			retry: false,
			// Keep the read revision stable while correcting input. A stale save is
			// rejected; reopening the dialog explicitly loads the latest feedback.
			staleTime: Infinity,
			refetchOnMount: 'always',
			gcTime: 0,
		}),
	list: (
		query: ORPCRouterInputs['submission']['list']['query'],
		userId: string
	) =>
		orpc.submission.list.queryOptions({
			input: { query },
			// Keep private results separate when accounts change in one browser.
			queryKey: [
				...orpc.submission.list.queryKey({ input: { query } }),
				{ userId },
			],
		}),
}
