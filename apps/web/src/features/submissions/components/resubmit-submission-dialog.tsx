import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { Button } from '@altstack/ui/components/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@altstack/ui/components/dialog'

import { SubmissionForm } from '#/features/submissions/components/submission-form'
import { submissionQueries } from '#/features/submissions/queries'
import { orpc } from '#/utils/orpc'

export function ResubmitSubmissionDialog({
	id,
	userId,
	onClose,
	onSuccess,
}: {
	id: string
	userId: string
	onClose: () => void
	onSuccess: () => void
}) {
	const intake = useQuery(submissionQueries.getById(id, userId))
	const queryClient = useQueryClient()
	const router = useRouter()
	const mutation = useMutation({
		...orpc.submission.resubmit.mutationOptions(),
		retry: false,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: orpc.submission.list.key(),
			})
			await router.invalidate({ sync: true })
		},
	})
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !mutation.isPending) onClose()
			}}
		>
			<DialogContent
				showCloseButton={!mutation.isPending}
				className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
			>
				<DialogHeader>
					<DialogTitle>Edit &amp; Resubmit</DialogTitle>
					<DialogDescription>
						Correct your project details and send them back for review.
					</DialogDescription>
				</DialogHeader>
				{intake.isPending ? (
					<output>Loading your submission…</output>
				) : intake.isError ? (
					<div className="space-y-3">
						<p role="alert">{intake.error.message}</p>
						<Button variant="outline" onClick={() => void intake.refetch()}>
							Retry loading
						</Button>
					</div>
				) : (
					<>
						<div className="space-y-1 rounded-lg border bg-muted p-4">
							<h2 className="text-sm font-medium">Review feedback</h2>
							<p className="text-sm whitespace-pre-wrap">
								{intake.data.rejectionReason ??
									'No feedback was recorded for this submission.'}
							</p>
						</div>
						<SubmissionForm
							resubmit
							initialValues={{
								name: intake.data.name,
								repositoryUrl: intake.data.repositoryUrl,
								websiteUrl: intake.data.websiteUrl ?? '',
							}}
							onSubmit={async (values) => {
								await mutation.mutateAsync({
									params: { id },
									body: { ...values, revision: intake.data.revision },
								})
								onSuccess()
							}}
						/>
					</>
				)}
				<Button
					variant="outline"
					disabled={mutation.isPending}
					onClick={onClose}
				>
					Cancel
				</Button>
			</DialogContent>
		</Dialog>
	)
}
