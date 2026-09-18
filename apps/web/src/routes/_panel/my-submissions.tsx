import { createFileRoute } from '@tanstack/react-router'

import { submissionColumns } from '#/components/submission-columns'
import { SubmissionDataTable } from '#/components/submission-data-table'
import { useListSubmissions } from '#/features/submissions/queries'

export const Route = createFileRoute('/_panel/my-submissions')({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(
			context.orpc.submission.list.queryOptions()
		)
	},
	component: RouteComponent,
})

function RouteComponent() {
	const { data } = useListSubmissions()

	return (
		<div>
			<div className="mx-auto w-full px-4">
				<SubmissionDataTable columns={submissionColumns} data={data} />
			</div>
		</div>
	)
}
