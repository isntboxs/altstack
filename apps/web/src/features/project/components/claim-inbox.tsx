import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useRouteContext } from '@tanstack/react-router'
import { useState } from 'react'

import { Badge } from '@altstack/ui/components/badge'
import { Button, buttonVariants } from '@altstack/ui/components/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@altstack/ui/components/dialog'
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from '@altstack/ui/components/field'
import { Textarea } from '@altstack/ui/components/textarea'
import { toast } from '@altstack/ui/components/toast'

import {
	AdminEmpty,
	AdminError,
	AdminPending,
	AdminTime,
	RefreshButton,
} from '#/features/admin-dashboard/components/dashboard-state'
import { adminDashboardKey } from '#/features/admin-dashboard/queries'
import { ClaimGithubEvidenceView } from '#/features/project/components/claim-github-evidence'
import { ownershipKey, ownershipQueries } from '#/features/project/ownership'
import { invalidateCatalog } from '#/utils/invalidate-catalog'
import { client } from '#/utils/orpc'

function hasShortNote(note: string | undefined) {
	const length = note?.trim().length ?? 0
	return length > 0 && length < 20
}

export function ClaimInbox({
	page,
	claimId,
	onPageChange,
}: {
	page: number
	claimId?: string
	onPageChange: (page: number) => void
}) {
	const { auth } = useRouteContext({ from: '/_main' })
	const queryClient = useQueryClient()
	const query = useQuery({
		...ownershipQueries.inbox(auth.user.id, page, claimId),
		retry: false,
	})
	const [notes, setNotes] = useState<Partial<Record<string, string>>>({})
	const [decision, setDecision] = useState<{
		id: string
		decision: 'approve' | 'reject'
	} | null>(null)
	const selected = query.data?.claims.find((claim) => claim.id === decision?.id)
	const noteLength = selected ? (notes[selected.id]?.trim().length ?? 0) : 0
	const review = useMutation({
		mutationFn: (input: {
			id: string
			decision: 'approve' | 'reject'
			manualEvidence?: string
		}) =>
			client.ownership.review({
				params: { id: input.id },
				body: {
					decision: input.decision,
					manualEvidence: input.manualEvidence,
				},
			}),
		retry: false,
		onSuccess: async () => {
			setDecision(null)
			toast.add({ type: 'success', title: 'Access request reviewed' })
			await invalidateCatalog(queryClient)
		},
		onError: (error) =>
			toast.add({
				type: 'error',
				title: 'Unable to review request',
				description: error.message,
			}),
		onSettled: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ownershipKey }),
				queryClient.invalidateQueries({ queryKey: adminDashboardKey }),
			])
		},
	})
	return (
		<section aria-label="Ownership requests" className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<p className="max-w-2xl text-sm text-muted-foreground">
					Only approve someone you have confirmed represents the project. Admins
					review the first representative; existing representatives review
					additional requests. Your own requests cannot be reviewed here.
				</p>
				<RefreshButton
					fetching={query.isFetching}
					refresh={() => void query.refetch()}
				/>
			</div>
			{query.isPending ? (
				<AdminPending />
			) : query.isError ? (
				<AdminError retry={() => void query.refetch()} />
			) : (
				<>
					{query.data.claims.length === 0 && (
						<AdminEmpty
							title="No requests awaiting your review"
							description={
								claimId
									? 'This request may already be reviewed or no longer eligible. Return to all requests to continue.'
									: 'Email confirmed requests appear here when you are eligible to review them.'
							}
						/>
					)}
					{query.data.claims.map((claim) => (
						<Card key={claim.id}>
							<CardHeader>
								<CardTitle>{claim.projectName}</CardTitle>
								<CardDescription>
									{claim.name} · {claim.role} access
								</CardDescription>
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant="secondary">Pending</Badge>
									<Badge variant="outline">Email confirmed</Badge>
									<span className="text-xs text-muted-foreground">
										Requested <AdminTime value={claim.requestedAt} relative />
									</span>
								</div>
							</CardHeader>
							<CardContent className="flex flex-col gap-4">
								<p className="text-sm wrap-anywhere">{claim.email}</p>
								<ClaimGithubEvidenceView evidence={claim.githubEvidence} />
								<FieldGroup>
									<Field data-invalid={hasShortNote(notes[claim.id])}>
										<FieldLabel htmlFor={`evidence-${claim.id}`}>
											Independent verification notes for {claim.projectName}
										</FieldLabel>
										<Textarea
											id={`evidence-${claim.id}`}
											value={notes[claim.id] ?? ''}
											aria-invalid={hasShortNote(notes[claim.id])}
											onChange={(event) =>
												setNotes((previous) => {
													return {
														...previous,
														[claim.id]: event.target.value,
													}
												})
											}
											maxLength={1000}
											disabled={review.isPending}
											placeholder="How did you confirm this person represents the project?"
										/>
										<FieldDescription>
											Required when GitHub cannot confirm access (20–1000
											characters). GitHub evidence is checked again on approval.
											Notes remain private.
										</FieldDescription>
										{hasShortNote(notes[claim.id]) && (
											<FieldError>
												Enter at least 20 characters or clear this optional note
												when GitHub access is verified.
											</FieldError>
										)}
									</Field>
								</FieldGroup>
								<div className="flex flex-wrap justify-end gap-2">
									<Link
										to="/$slug"
										params={{ slug: claim.projectSlug }}
										className={buttonVariants({ variant: 'link' })}
									>
										View project
									</Link>
									{auth.user.role === 'admin' && (
										<Link
											to="/projects/$id/edit"
											params={{ id: claim.projectId }}
											className={buttonVariants({ variant: 'outline' })}
										>
											Project details
										</Link>
									)}
									<Button
										variant="outline"
										disabled={review.isPending}
										onClick={() => {
											review.reset()
											setDecision({ id: claim.id, decision: 'reject' })
										}}
									>
										Decline
									</Button>
									<Button
										disabled={review.isPending}
										onClick={() => {
											review.reset()
											setDecision({ id: claim.id, decision: 'approve' })
										}}
									>
										Approve
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
					<nav
						aria-label="Ownership request pages"
						className="flex flex-wrap items-center justify-end gap-3"
					>
						<p className="mr-auto text-sm text-muted-foreground">
							{query.data.pagination.totalItems} requests · Page {page} of{' '}
							{Math.max(1, query.data.pagination.totalPages)}
						</p>
						<Button
							variant="outline"
							disabled={page <= 1 || query.isFetching}
							onClick={() => onPageChange(page - 1)}
						>
							Previous requests
						</Button>
						<Button
							variant="outline"
							disabled={!query.data.pagination.hasNextPage || query.isFetching}
							onClick={() => onPageChange(page + 1)}
						>
							Next requests
						</Button>
					</nav>
				</>
			)}
			<Dialog
				open={!!decision}
				onOpenChange={(open) => {
					if (!open && !review.isPending) setDecision(null)
				}}
			>
				<DialogContent showCloseButton={!review.isPending}>
					<DialogHeader>
						<DialogTitle>
							{decision?.decision === 'approve'
								? 'Approve project access?'
								: 'Decline access request?'}
						</DialogTitle>
						<DialogDescription>
							{selected
								? `${selected.name} is requesting ${selected.role} access to ${selected.projectName}.`
								: 'This request is no longer in the current queue.'}
						</DialogDescription>
					</DialogHeader>
					<p className="text-sm">
						{decision?.decision === 'approve'
							? 'Approval grants permission to edit the published project and review future access requests. Confirm independent verification before continuing.'
							: 'This person will not receive project access from this request.'}
					</p>
					{review.isError && (
						<p role="alert" className="text-sm text-destructive">
							{review.error.message}
						</p>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							disabled={review.isPending}
							onClick={() => setDecision(null)}
						>
							Cancel
						</Button>
						<Button
							variant={
								decision?.decision === 'reject' ? 'destructive' : 'default'
							}
							disabled={
								!selected ||
								review.isPending ||
								(decision?.decision === 'approve' &&
									(selected.githubEvidence?.status !== 'verified' ||
										noteLength > 0) &&
									noteLength < 20)
							}
							onClick={() => {
								if (!decision) return
								const note = notes[decision.id]?.trim()
								review.mutate({
									...decision,
									manualEvidence:
										decision.decision === 'approve' && note ? note : undefined,
								})
							}}
						>
							{review.isPending ? 'Saving…' : 'Confirm decision'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	)
}
