import { IconRefresh } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'

import { adminListReportsQuerySchema } from '@altstack/shared/schemas/admin-report'
import { reportStatuses } from '@altstack/shared/schemas/report'

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@altstack/ui/components/alert'
import { Button } from '@altstack/ui/components/button'
import { Field, FieldLabel } from '@altstack/ui/components/field'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@altstack/ui/components/select'
import { Skeleton } from '@altstack/ui/components/skeleton'

import { AdminPageHeader } from '#/features/admin-dashboard/components/dashboard-state'
import type { adminReportSearchSchema } from '#/features/admin-dashboard/search'
import { ReportDataTable } from '#/features/admin-reports/components/report-data-table'
import { useAdminReportList } from '#/features/admin-reports/queries'
import { adminORPC } from '#/utils/orpc'

const statusItems = [...reportStatuses, { value: 'all', label: 'All statuses' }]

export function ReportInbox({
	search,
	onSearchChange,
}: {
	search: z.infer<typeof adminReportSearchSchema>
	onSearchChange: (search: z.infer<typeof adminReportSearchSchema>) => void
}) {
	const queryClient = useQueryClient()
	const status = search.status ?? 'open'
	const trail = search.trail ?? []
	const query = useAdminReportList(
		adminListReportsQuerySchema.parse({
			status,
			cursor: search.cursor,
			reportId: search.reportId,
		})
	)
	return (
		<div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
			<AdminPageHeader
				title="Reports"
				description="Review reported issues and suggested corrections. Update the project, then resolve or dismiss the report."
			/>
			<div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border bg-card p-4">
				<Field className="w-full sm:w-44">
					<FieldLabel htmlFor="report-status">Report status</FieldLabel>
					<Select
						items={statusItems}
						value={status}
						onValueChange={(value) => {
							if (!value) return
							onSearchChange({
								status: adminListReportsQuerySchema.shape.status.parse(value),
							})
						}}
					>
						<SelectTrigger
							id="report-status"
							aria-label="Filter report status"
							className="w-full"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{statusItems.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
				<Button
					variant="outline"
					size="sm"
					disabled={query.isFetching}
					onClick={() => {
						// Invalidate cached pages before switching back to page one.
						void queryClient.invalidateQueries({
							queryKey: adminORPC.report.list.key(),
							refetchType: 'none',
						})
						onSearchChange({ ...search, cursor: undefined, trail: undefined })
						if (!search.cursor) void query.refetch()
					}}
				>
					<IconRefresh data-icon="inline-start" />
					Refresh inbox
				</Button>
			</div>
			{search.reportId && (
				<Alert>
					<AlertTitle>Viewing a selected report</AlertTitle>
					<AlertDescription>
						<p>This view shows the report opened from your review queue.</p>
						<Button
							variant="outline"
							onClick={() => onSearchChange({ status: 'open' })}
						>
							View all open reports
						</Button>
					</AlertDescription>
				</Alert>
			)}
			{query.isPending ? <ReportsPending /> : null}
			{query.isError && (
				<Alert variant="destructive">
					<AlertTitle>Unable to load reports</AlertTitle>
					<AlertDescription>
						<p>Check your admin session and try again.</p>
						<Button
							variant="outline"
							size="sm"
							disabled={query.isFetching}
							onClick={() => void query.refetch()}
						>
							Retry loading
						</Button>
					</AlertDescription>
				</Alert>
			)}
			{query.data && (
				<div aria-busy={query.isFetching}>
					<ReportDataTable reports={query.data.reports} />
				</div>
			)}
			<nav
				aria-label="Report pages"
				className="flex flex-wrap items-center justify-end gap-3 rounded-xl border bg-card px-4 py-3"
			>
				<p className="mr-auto text-sm text-muted-foreground">
					Newest first · Page {trail.length + 1}
					{search.reportId ? ' · Selected report' : ''}
				</p>
				<Button
					variant="outline"
					size="sm"
					disabled={!search.cursor || query.isFetching}
					onClick={() =>
						onSearchChange({
							...search,
							cursor: trail.at(-1) ?? undefined,
							trail: trail.slice(0, -1),
						})
					}
				>
					Previous
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={
						!query.data?.nextCursor || query.isFetching || query.isError
					}
					onClick={() => {
						const cursor = query.data?.nextCursor
						if (cursor) {
							onSearchChange({
								...search,
								cursor,
								trail: [...trail, search.cursor ?? null],
							})
						}
					}}
				>
					Next
				</Button>
			</nav>
		</div>
	)
}

export function ReportsPending() {
	return (
		<output aria-label="Loading reports" className="flex flex-col gap-3">
			<Skeleton className="h-64 w-full rounded-xl" />
			<Skeleton className="h-64 w-full rounded-xl" />
		</output>
	)
}
