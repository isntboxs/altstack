import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@altstack/ui/components/alert'
import { Badge } from '@altstack/ui/components/badge'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'

import { QueryBoundary } from '#/components/query-boundary'
import {
	AdminError,
	AdminPageHeader,
	AdminPending,
	AdminTime,
	RefreshButton,
} from '#/features/admin-dashboard/components/dashboard-state'
import { dashboardQueries } from '#/features/admin-dashboard/queries'

export const Route = createFileRoute('/_main/admin/operations')({
	component: () => (
		<QueryBoundary
			pending={<AdminPending />}
			error={(_, retry) => <AdminError retry={retry} />}
		>
			<Operations />
		</QueryBoundary>
	),
})
function Operations() {
	const { auth } = Route.useRouteContext()
	const query = useSuspenseQuery(dashboardQueries.operations(auth.user.id))
	const data = query.data
	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
			<AdminPageHeader
				title="Operations"
				description="Database observations for GitHub freshness and submission review emails."
			>
				<RefreshButton
					fetching={query.isFetching}
					refresh={() => void query.refetch()}
				/>
			</AdminPageHeader>
			{query.isError ? (
				<AdminError retry={() => void query.refetch()} />
			) : (
				<>
					<p className="text-xs text-muted-foreground">
						Observed <AdminTime value={data.observedAt} /> · refreshes every
						minute
					</p>
					<div className="grid items-start gap-6 lg:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle>GitHub refresh</CardTitle>
								<CardDescription>
									Published projects · freshness threshold:{' '}
									{data.github.staleAfterHours} hours
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-col gap-5">
								<dl className="grid grid-cols-2 gap-4">
									{[
										['Fresh', data.github.fresh],
										['Stale', data.github.stale],
										['Missing snapshot', data.github.missing],
										['Published projects', data.github.total],
									].map(([label, value]) => (
										<div key={label}>
											<dt className="text-sm text-muted-foreground">{label}</dt>
											<dd className="text-2xl font-semibold tabular-nums">
												{value.toLocaleString()}
											</dd>
										</div>
									))}
								</dl>
								<dl className="flex flex-col gap-2 text-sm">
									<div>
										<dt className="text-muted-foreground">
											Latest successful snapshot
										</dt>
										<dd>
											<AdminTime value={data.github.latestFetchedAt} />
										</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">
											Oldest successful snapshot
										</dt>
										<dd>
											<AdminTime value={data.github.oldestFetchedAt} />
										</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">
											Batch failures / scheduler health
										</dt>
										<dd>
											<Badge variant="outline">Unavailable</Badge>
										</dd>
									</div>
								</dl>
								<Alert>
									<AlertTitle>Freshness measures stored data</AlertTitle>
									<AlertDescription>
										Daily refresh failures and scheduler runs are recorded in
										server logs, without persistent run telemetry. Stale data
										can indicate delayed updates; it does not prove a failed
										job.
									</AlertDescription>
								</Alert>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle>Review email outbox</CardTitle>
								<CardDescription>
									All recorded submission review notifications
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-col gap-5">
								<dl className="grid grid-cols-2 gap-4">
									{[
										['Pending', data.outbox.pending],
										['Failed', data.outbox.failed],
										['Sent', data.outbox.sent],
										['Cancelled', data.outbox.cancelled],
									].map(([label, value]) => (
										<div key={label}>
											<dt className="text-sm text-muted-foreground">{label}</dt>
											<dd className="text-2xl font-semibold tabular-nums">
												{value.toLocaleString()}
											</dd>
										</div>
									))}
								</dl>
								<dl className="flex flex-col gap-2 text-sm">
									<div>
										<dt className="text-muted-foreground">
											Pending and due for delivery
										</dt>
										<dd>{data.outbox.due.toLocaleString()}</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">
											Oldest pending notification
										</dt>
										<dd>
											<AdminTime value={data.outbox.oldestPendingAt} />
										</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Last sent</dt>
										<dd>
											<AdminTime value={data.outbox.lastSentAt} />
										</dd>
									</div>
								</dl>
								<Alert
									variant={data.outbox.failed > 0 ? 'destructive' : 'default'}
								>
									<AlertTitle>
										{data.outbox.failed > 0
											? 'Failed notifications need investigation'
											: 'Delivery status'}
									</AlertTitle>
									<AlertDescription>
										Sent means the email provider accepted the message, not
										confirmed inbox delivery. The scheduled worker handles
										retries. Recipient details and email contents stay private.
									</AlertDescription>
								</Alert>
							</CardContent>
						</Card>
					</div>
				</>
			)}
		</div>
	)
}
