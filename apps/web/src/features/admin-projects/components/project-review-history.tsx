import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { Button } from '@altstack/ui/components/button'

import { useAdminProjectReviewHistory } from '#/features/admin-projects/queries'

type ReviewEvent =
	ORPCRouterOutputs['admin']['project']['reviewHistory']['events'][number]

const actionLabels = {
	project_created: 'Created project',
	project_submitted: 'Submitted project',
	project_status_changed: 'Changed status',
}

function statusLabel(status: NonNullable<ReviewEvent['toStatus']>) {
	return status.charAt(0).toUpperCase() + status.slice(1)
}

function ReviewHistoryEvent({ event }: { event: ReviewEvent }) {
	const transition =
		event.fromStatus && event.toStatus
			? `${statusLabel(event.fromStatus)} → ${statusLabel(event.toStatus)}`
			: event.toStatus
				? `To ${statusLabel(event.toStatus)}`
				: event.fromStatus
					? `From ${statusLabel(event.fromStatus)}`
					: null
	return (
		<li className="space-y-2 p-4">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<p className="text-sm">
					<strong>{event.actor?.name ?? 'Unknown user'}</strong>
					{' · '}
					{actionLabels[event.action]}
				</p>
				<time
					dateTime={event.createdAt.toISOString()}
					className="text-xs text-muted-foreground"
				>
					{event.createdAt.toLocaleString('en-US', {
						timeZone: 'UTC',
						dateStyle: 'medium',
						timeStyle: 'short',
					})}{' '}
					UTC
				</time>
			</div>
			{transition && (
				<p className="text-sm text-muted-foreground">{transition}</p>
			)}
			{event.reason && (
				<p className="text-sm break-words whitespace-pre-wrap">
					<span className="font-medium">Reason: </span>
					{event.reason}
				</p>
			)}
		</li>
	)
}

export function ProjectReviewHistory({ projectId }: { projectId: string }) {
	const history = useAdminProjectReviewHistory({ id: projectId })
	const events = history.data?.pages.flatMap((page) => page.events) ?? []
	const total = history.data?.pages[0]?.pagination.totalItems ?? 0
	return (
		<section aria-label="Review history" className="space-y-4">
			<div className="space-y-1">
				<h2 className="text-sm font-semibold">Review history</h2>
				<p className="text-sm text-muted-foreground">
					Creation, submission and moderation activity, newest first.
				</p>
			</div>
			{history.isPending && (
				<output className="text-sm text-muted-foreground">
					Loading review history…
				</output>
			)}
			{events.length > 0 && (
				<ol className="divide-y rounded-md border">
					{events.map((event) => (
						<ReviewHistoryEvent key={event.id} event={event} />
					))}
				</ol>
			)}
			{!history.isPending && !history.isError && events.length === 0 && (
				<p className="rounded-md border p-4 text-sm text-muted-foreground">
					No review history yet.
				</p>
			)}
			{history.isError && (
				<div className="space-y-2">
					<p role="alert" className="text-sm text-destructive">
						{history.isFetchNextPageError
							? 'Unable to load older review history.'
							: 'Unable to load review history.'}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={history.isFetching}
						onClick={() => {
							void (history.isFetchNextPageError
								? history.fetchNextPage()
								: history.refetch())
						}}
					>
						Retry
					</Button>
				</div>
			)}
			{events.length > 0 && (
				<p className="text-xs text-muted-foreground">
					Showing {events.length} of {total} review events.
				</p>
			)}
			{history.hasNextPage && !history.isFetchNextPageError && (
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={history.isFetching}
					onClick={() => {
						void history.fetchNextPage()
					}}
				>
					{history.isFetchingNextPage
						? 'Loading older entries…'
						: 'Load older entries'}
				</Button>
			)}
		</section>
	)
}
