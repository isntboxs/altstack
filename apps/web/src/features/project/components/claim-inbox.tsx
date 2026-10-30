import {
	IconChevronDown,
	IconUserCheck,
	IconExternalLink,
	IconPencil,
	IconCheck,
	IconX,
} from '@tabler/icons-react'
import {
	useMutation,
	useSuspenseQuery,
	useQueryClient,
} from '@tanstack/react-query'
import { Link, useRouteContext } from '@tanstack/react-router'
import { useState, useDeferredValue } from 'react'

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@altstack/ui/components/alert'
import { Badge } from '@altstack/ui/components/badge'
import { Button, buttonVariants } from '@altstack/ui/components/button'
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@altstack/ui/components/collapsible'
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
	FieldLabel,
} from '@altstack/ui/components/field'
import { Skeleton } from '@altstack/ui/components/skeleton'
import { Textarea } from '@altstack/ui/components/textarea'
import { toast } from '@altstack/ui/components/toast'

import { QueryBoundary } from '#/components/query-boundary'
import {
	AdminEmpty,
	AdminError,
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
function VerificationNotes({
	id,
	label,
	value,
	disabled,
	required = false,
	onChange,
}: {
	id: string
	label: string
	value: string
	disabled: boolean
	required?: boolean
	onChange: (value: string) => void
}) {
	const invalid = hasShortNote(value)
	return (
		<Field data-invalid={invalid}>
			<div className="flex items-start justify-between gap-2">
				<FieldLabel htmlFor={id}>{label}</FieldLabel>
				<span className="shrink-0 text-xs text-muted-foreground">
					{value.trim().length}/1000
				</span>
			</div>
			<Textarea
				id={id}
				value={value}
				rows={3}
				required={required}
				aria-invalid={invalid}
				aria-describedby={`${id}-help${invalid ? ` ${id}-error` : ''}`}
				onChange={(event) => onChange(event.target.value)}
				maxLength={1000}
				disabled={disabled}
				placeholder="How did you confirm this person represents the project?"
			/>
			<FieldDescription id={`${id}-help`}>
				Required when GitHub cannot confirm access (20–1000 characters). GitHub
				evidence is checked again on approval. Notes remain private.
			</FieldDescription>
			{invalid && (
				<FieldError id={`${id}-error`}>
					{required
						? 'Enter at least 20 characters to explain how you verified this representative.'
						: 'Enter at least 20 characters or clear this optional note when GitHub access is verified.'}
				</FieldError>
			)}
		</Field>
	)
}

export function ClaimInbox(props: Parameters<typeof ClaimInboxContent>[0]) {
	const page = useDeferredValue(props.page)
	const claimId = useDeferredValue(props.claimId)
	return (
		<QueryBoundary
			pending={<OwnershipPending />}
			error={(_, retry) => <AdminError retry={retry} />}
		>
			<ClaimInboxContent {...props} page={page} claimId={claimId} />
		</QueryBoundary>
	)
}

function OwnershipPending() {
	return (
		<div className="flex flex-col gap-4">
			<output className="sr-only">Loading ownership requests</output>
			{[0, 1].map((id) => (
				<Skeleton key={id} className="h-64 w-full rounded-xl" />
			))}
		</div>
	)
}

function ClaimInboxContent({
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
	const query = useSuspenseQuery({
		...ownershipQueries.inbox(auth.user.id, page, claimId),
		retry: false,
	})
	const [notes, setNotes] = useState<Partial<Record<string, string>>>({})
	const [decision, setDecision] = useState<{
		id: string
		decision: 'approve' | 'reject'
	} | null>(null)
	const selected = query.data.claims.find((claim) => claim.id === decision?.id)
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
	function updateNote(id: string, value: string) {
		setNotes((previous) => {
			return { ...previous, [id]: value }
		})
	}
	return (
		<section
			aria-label="Ownership requests"
			className="flex min-w-0 flex-col gap-5"
		>
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
				<div className="flex min-w-0 flex-col gap-1">
					<h2 className="text-sm font-medium">
						{claimId ? 'Selected request' : 'Awaiting review'}
						{` (${query.data.pagination.totalItems})`}
					</h2>
					<p className="text-xs text-muted-foreground">
						Email-confirmed requests you are eligible to review
					</p>
				</div>
				<RefreshButton
					fetching={query.isFetching}
					refresh={() => void query.refetch()}
				/>
			</div>
			{query.isError && (
				<AdminError
					fetching={query.isFetching}
					retry={() => void query.refetch()}
				/>
			)}
			{query.data.claims.length === 0 && (
				<div className="rounded-xl border bg-card py-8">
					<AdminEmpty
						title="No requests awaiting your review"
						description={
							claimId
								? 'This request may already be reviewed or no longer eligible. Return to all requests to continue.'
								: 'Email confirmed requests appear here when you are eligible to review them.'
						}
					/>
				</div>
			)}
			{query.data.claims.map((claim) => (
				<Card key={claim.id} className="min-w-0">
					<CardHeader className="border-b">
						<CardTitle>
							<h2 className="wrap-anywhere">{claim.projectName}</h2>
						</CardTitle>
						<CardDescription>Representative access request</CardDescription>
						<CardAction>
							<Badge variant="secondary">Pending</Badge>
						</CardAction>
					</CardHeader>
					<CardContent className="flex min-w-0 flex-col gap-5">
						<div className="flex min-w-0 items-start gap-3">
							<span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
								<IconUserCheck className="size-5" aria-hidden="true" />
							</span>
							<div className="flex min-w-0 flex-1 flex-col gap-1">
								<p className="text-sm font-medium wrap-anywhere">
									{claim.name}
								</p>
								<p className="text-sm wrap-anywhere text-muted-foreground">
									{claim.email}
								</p>
								<div className="mt-1 flex flex-wrap items-center gap-2">
									<Badge variant="outline">
										{claim.role === 'owner' ? 'Owner' : 'Maintainer'} access
									</Badge>
									<Badge variant="outline">Email confirmed</Badge>
								</div>
							</div>
						</div>
						<p className="text-xs text-muted-foreground">
							Requested <AdminTime value={claim.requestedAt} relative />
						</p>
						<Collapsible
							key={`${claim.id}:${claimId ?? ''}`}
							defaultOpen={
								!!claimId ||
								query.data.claims.length === 1 ||
								auth.user.role !== 'admin'
							}
							className="flex flex-col gap-4"
						>
							<CollapsibleTrigger
								render={
									<Button variant="outline" className="group w-full sm:w-fit" />
								}
							>
								<span>Verification & review</span>
								<IconChevronDown
									data-icon="inline-end"
									className="group-aria-expanded:rotate-180"
								/>
							</CollapsibleTrigger>
							<CollapsibleContent className="flex min-w-0 flex-col gap-5">
								<div className="grid min-w-0 gap-5 lg:grid-cols-2">
									<div className="flex min-w-0 flex-col gap-3">
										<h3 className="text-sm font-medium">Repository evidence</h3>
										<ClaimGithubEvidenceView evidence={claim.githubEvidence} />
										<p className="text-xs leading-relaxed text-muted-foreground">
											Approve only after confirming that this person represents
											the project. Approval grants editing access and permission
											to review future requests.
										</p>
									</div>
									<VerificationNotes
										id={`evidence-${claim.id}`}
										label={`Independent verification notes for ${claim.projectName}`}
										value={notes[claim.id] ?? ''}
										required={claim.githubEvidence?.status !== 'verified'}
										disabled={review.isPending}
										onChange={(value) => updateNote(claim.id, value)}
									/>
								</div>
								<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
									<div className="flex flex-wrap items-center gap-2">
										<Link
											to="/$slug"
											params={{ slug: claim.projectSlug }}
											className={buttonVariants({
												variant: 'outline',
												size: 'sm',
											})}
										>
											<IconExternalLink data-icon="inline-start" />
											View project
										</Link>
										{auth.user.role === 'admin' && (
											<Link
												to="/projects/$id/edit"
												params={{ id: claim.projectId }}
												className={buttonVariants({
													variant: 'outline',
													size: 'sm',
												})}
											>
												<IconPencil data-icon="inline-start" />
												Project details
											</Link>
										)}
									</div>
									<div className="ml-auto flex items-center gap-2">
										<Button
											variant="outline"
											disabled={review.isPending}
											onClick={() => {
												review.reset()
												setDecision({ id: claim.id, decision: 'reject' })
											}}
										>
											<IconX data-icon="inline-start" />
											Decline
										</Button>
										<Button
											disabled={review.isPending}
											onClick={() => {
												review.reset()
												setDecision({ id: claim.id, decision: 'approve' })
											}}
										>
											<IconCheck data-icon="inline-start" />
											Approve
										</Button>
									</div>
								</div>
							</CollapsibleContent>
						</Collapsible>
					</CardContent>
				</Card>
			))}
			<nav
				aria-label="Ownership request pages"
				className="flex flex-wrap items-center justify-end gap-3 rounded-xl border bg-card px-4 py-3"
			>
				<p className="mr-auto text-xs text-muted-foreground">
					{query.data.pagination.totalItems}{' '}
					{query.data.pagination.totalItems === 1 ? 'request' : 'requests'} ·
					Page {page}
				</p>
				<Button
					variant="outline"
					size="sm"
					disabled={page <= 1 || query.isFetching}
					onClick={() => onPageChange(page - 1)}
				>
					Previous requests
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={!query.data.pagination.hasNextPage || query.isFetching}
					onClick={() => onPageChange(page + 1)}
				>
					Next requests
				</Button>
			</nav>
			<p className="text-xs leading-relaxed text-muted-foreground">
				Admins review a project’s first representative; existing representatives
				review additional requests. Your own requests cannot be reviewed here.
			</p>
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
					{selected && decision?.decision === 'approve' && (
						<VerificationNotes
							id="decision-verification-notes"
							label="Verification notes"
							value={notes[selected.id] ?? ''}
							required={selected.githubEvidence?.status !== 'verified'}
							disabled={review.isPending}
							onChange={(value) => updateNote(selected.id, value)}
						/>
					)}
					{review.isError && (
						<Alert variant="destructive">
							<AlertTitle>Unable to review request</AlertTitle>
							<AlertDescription>{review.error.message}</AlertDescription>
						</Alert>
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
