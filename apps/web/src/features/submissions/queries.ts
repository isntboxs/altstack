import type { ORPCRouterInputs } from '@altstack/api/routers'

import { orpc } from '#/utils/orpc'

export const submissionQueries = {
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
