import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { ResubmitSubmissionDialog } from '#/features/submissions/components/resubmit-submission-dialog'
import { SubmissionDataTable } from '#/features/submissions/components/submission-data-table'
import { submissionQueries } from '#/features/submissions/queries'
import { submissionSearchSchema } from '#/features/submissions/search'

export const Route = createFileRoute('/_main/submission')({
	validateSearch: submissionSearchSchema,
	loaderDeps: ({ search: { q, page, limit } }) => {
		return { q, page, limit }
	},
	loader: ({ context, deps }) =>
		context.queryClient.query(
			submissionQueries.list(deps, context.auth.user.id)
		),
	component: SubmissionPage,
})

function SubmissionPage() {
	const [editingId, setEditingId] = useState<string | null>(null)
	const [resubmitted, setResubmitted] = useState(false)
	const { auth } = Route.useRouteContext()
	const data = Route.useLoaderData()
	const { q } = Route.useSearch()
	const navigate = Route.useNavigate()
	return (
		<div className="mx-auto w-full max-w-7xl space-y-5 px-4 pt-4 pb-8 sm:px-6">
			<div className="space-y-1">
				<h1 className="text-2xl font-medium tracking-tight">Submission</h1>
				<p className="text-sm text-muted-foreground">
					Track your submitted projects and their review status.
				</p>
			</div>
			{resubmitted && (
				<output className="block rounded-lg border bg-muted p-4 text-sm">
					Your project has been resubmitted and is awaiting review.
				</output>
			)}
			{editingId && (
				<ResubmitSubmissionDialog
					key={editingId}
					id={editingId}
					userId={auth.user.id}
					onClose={() => setEditingId(null)}
					onSuccess={() => {
						setEditingId(null)
						setResubmitted(true)
					}}
				/>
			)}
			<SubmissionDataTable
				data={data}
				query={q ?? ''}
				onResubmit={(id) => {
					setResubmitted(false)
					setEditingId(id)
				}}
				onQueryChange={(nextQuery) =>
					void navigate({
						search: (previous) => {
							return {
								...previous,
								q: nextQuery || undefined,
								page: undefined,
							}
						},
						replace: true,
					})
				}
				onPageChange={(page) =>
					void navigate({
						search: (previous) => {
							return { ...previous, page }
						},
					})
				}
				onPageSizeChange={(limit) =>
					void navigate({
						search: (previous) => {
							return { ...previous, limit, page: undefined }
						},
					})
				}
			/>
		</div>
	)
}
