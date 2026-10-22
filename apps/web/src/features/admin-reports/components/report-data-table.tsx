import { Link } from '@tanstack/react-router'
import { formatDate } from 'date-fns'

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
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@altstack/ui/components/empty'
import { Spinner } from '@altstack/ui/components/spinner'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@altstack/ui/components/table'

import { ProjectLogo } from '#/components/project-media'
import { useAdminReportModerate } from '#/features/admin-reports/queries'

type Report = ORPCRouterOutputs['admin']['report']['list']['reports'][number]

export function ReportDataTable({ reports }: { reports: Array<Report> }) {
	return (
		<div className="overflow-hidden rounded-md border">
			<Table aria-label="Project reports">
				<TableHeader>
					<TableRow>
						<TableHead>Project</TableHead>
						<TableHead>Reporter email</TableHead>
						<TableHead>Type</TableHead>
						<TableHead>Message</TableHead>
						<TableHead>Submitted</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{reports.map((report) => (
						<TableRow key={report.id}>
							<TableCell>
								{report.project ? (
									<div className="flex min-w-40 items-center gap-3">
										<ProjectLogo
											src={report.project.logo}
											name={report.project.name}
											className="size-8"
										/>
										<div className="flex flex-col gap-1">
											<p className="max-w-52 truncate">{report.project.name}</p>
											{report.project.status !== 'published' && (
												<Badge variant="outline">{report.project.status}</Badge>
											)}
										</div>
									</div>
								) : (
									<span className="text-muted-foreground">Project deleted</span>
								)}
							</TableCell>
							<TableCell className="max-w-64 wrap-anywhere whitespace-normal">
								{report.email}
							</TableCell>
							<TableCell>
								{reportTypes.find((type) => type.value === report.type)?.label}
							</TableCell>
							<TableCell className="max-w-md min-w-64 wrap-anywhere whitespace-pre-wrap">
								{report.message || '—'}
							</TableCell>
							<TableCell>
								<time dateTime={new Date(report.createdAt).toISOString()}>
									{formatDate(report.createdAt, 'MMM d, yyyy HH:mm')}
								</time>
							</TableCell>
							<TableCell>
								<Badge
									variant={report.status === 'open' ? 'default' : 'secondary'}
								>
									{
										reportStatuses.find(
											(status) => status.value === report.status
										)?.label
									}
								</Badge>
							</TableCell>
							<TableCell>
								<ReportActions report={report} />
							</TableCell>
						</TableRow>
					))}
					{reports.length === 0 && (
						<TableRow>
							<TableCell colSpan={7}>
								<Empty>
									<EmptyHeader>
										<EmptyTitle>No reports on this page</EmptyTitle>
										<EmptyDescription>
											Try another status or an earlier page.
										</EmptyDescription>
									</EmptyHeader>
								</Empty>
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	)
}

function ReportActions({ report }: { report: Report }) {
	const mutation = useAdminReportModerate()
	return (
		<div className="flex min-w-44 flex-col items-start gap-2">
			{report.project && (
				<Link
					to="/projects/$id/edit"
					params={{ id: report.project.id }}
					className={buttonVariants({ variant: 'link', size: 'sm' })}
				>
					Edit project
				</Link>
			)}
			{report.status === 'open' && (
				<div className="flex items-center gap-2" aria-busy={mutation.isPending}>
					<Button
						size="sm"
						variant="outline"
						disabled={mutation.isPending}
						onClick={() =>
							mutation.mutate({
								params: { id: report.id },
								body: { status: 'resolved' },
							})
						}
					>
						Resolve
					</Button>
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
						Dismiss
					</Button>
					{mutation.isPending && <Spinner aria-label="Saving report status" />}
				</div>
			)}
			{mutation.isError && (
				<Alert variant="destructive" className="max-w-64 whitespace-normal">
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
