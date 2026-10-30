import { IconFlag, IconPencil, IconCheck, IconX } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { reportStatuses, reportTypes } from '@altstack/shared/schemas/report'

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
	CardFooter,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@altstack/ui/components/empty'
import { Spinner } from '@altstack/ui/components/spinner'

import { ProjectLogo } from '#/components/project-media'
import { AdminTime } from '#/features/admin-dashboard/components/dashboard-state'
import { useAdminReportModerate } from '#/features/admin-reports/queries'

type Report = ORPCRouterOutputs['admin']['report']['list']['reports'][number]

export function ReportDataTable({ reports }: { reports: Array<Report> }) {
	return (
		<section
			aria-label="Project reports"
			className="flex min-w-0 flex-col gap-4"
		>
			{reports.length === 0 && (
				<Empty className="min-h-64 border bg-card">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<IconFlag />
						</EmptyMedia>
						<EmptyTitle>No reports on this page</EmptyTitle>
						<EmptyDescription>
							Try another status or an earlier page.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
			{reports.map((report) => (
				<Card key={report.id} className="min-w-0">
					<CardHeader className="border-b">
						<div className="flex min-w-0 items-center gap-3">
							{report.project ? (
								<ProjectLogo
									src={report.project.logo}
									name={report.project.name}
									className="size-9 shrink-0 rounded-lg"
								/>
							) : (
								<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
									<IconFlag className="size-4" aria-hidden="true" />
								</span>
							)}
							<div className="flex min-w-0 flex-col gap-1">
								<CardTitle>
									<h2 className="wrap-anywhere">
										{report.project?.name ?? 'Project deleted'}
									</h2>
								</CardTitle>
								<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
									<span>
										{
											reportTypes.find((type) => type.value === report.type)
												?.label
										}
									</span>
									{report.project && report.project.status !== 'published' && (
										<Badge variant="outline">{report.project.status}</Badge>
									)}
								</div>
							</div>
						</div>
						<CardAction>
							<Badge
								variant={report.status === 'open' ? 'default' : 'secondary'}
							>
								{
									reportStatuses.find(
										(status) => status.value === report.status
									)?.label
								}
							</Badge>
						</CardAction>
					</CardHeader>
					<CardContent className="flex min-w-0 flex-col gap-4">
						<div className="flex flex-col gap-2">
							<h3 className="text-xs font-medium text-muted-foreground">
								Reported issue
							</h3>
							<p className="max-h-72 overflow-y-auto rounded-lg border bg-muted/20 p-4 text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap">
								{report.message || 'No additional details provided.'}
							</p>
						</div>
						<dl className="grid min-w-0 gap-3 text-xs sm:grid-cols-2">
							<div className="flex min-w-0 flex-col gap-1">
								<dt className="text-muted-foreground">Reporter email</dt>
								<dd className="wrap-anywhere">{report.email}</dd>
							</div>
							<div className="flex flex-col gap-1">
								<dt className="text-muted-foreground">Submitted</dt>
								<dd>
									<AdminTime value={report.createdAt} />
								</dd>
							</div>
						</dl>
					</CardContent>
					<CardFooter className="flex-col items-stretch gap-3">
						<p className="text-xs text-muted-foreground">
							{report.status === 'open'
								? 'Correct the project first, then resolve the report. Dismiss reports that need no action.'
								: `This report has been ${report.status}.`}
						</p>
						<ReportActions report={report} />
					</CardFooter>
				</Card>
			))}
		</section>
	)
}

function ReportActions({ report }: { report: Report }) {
	const mutation = useAdminReportModerate()
	return (
		<div className="flex min-w-0 flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-3">
				{report.project && (
					<Link
						to="/projects/$id/edit"
						params={{ id: report.project.id }}
						className={buttonVariants({ variant: 'outline', size: 'sm' })}
					>
						<IconPencil data-icon="inline-start" />
						Edit project
					</Link>
				)}
				{report.status === 'open' && (
					<div
						className="ml-auto flex flex-wrap items-center gap-2"
						aria-busy={mutation.isPending}
					>
						<Button
							size="sm"
							variant="ghost"
							disabled={mutation.isPending}
							onClick={() =>
								mutation.mutate({
									params: { id: report.id },
									body: { status: 'dismissed' },
								})
							}
						>
							<IconX data-icon="inline-start" />
							Dismiss
						</Button>
						<Button
							size="sm"
							disabled={mutation.isPending}
							onClick={() =>
								mutation.mutate({
									params: { id: report.id },
									body: { status: 'resolved' },
								})
							}
						>
							<IconCheck data-icon="inline-start" />
							Resolve
						</Button>
						{mutation.isPending && (
							<Spinner aria-label="Saving report status" />
						)}
					</div>
				)}
			</div>
			{mutation.isError && (
				<Alert variant="destructive">
					<AlertTitle>Unable to update report</AlertTitle>
					<AlertDescription>
						{'code' in mutation.error && mutation.error.code === 'CONFLICT'
							? 'Another admin has already reviewed this report. The inbox has been refreshed.'
							: 'Refresh the inbox before trying again.'}
					</AlertDescription>
				</Alert>
			)}
		</div>
	)
}
