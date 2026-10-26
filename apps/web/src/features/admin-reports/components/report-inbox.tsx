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
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@altstack/ui/components/select'
import { Skeleton } from '@altstack/ui/components/skeleton'

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
		<div className="mx-auto flex w-full min-w-0 flex-col gap-5 px-4 py-6">
			<div className="flex flex-col gap-1">
				<h1 className="text-xl font-semibold">Reports</h1>
				<p className="text-sm text-muted-foreground">
					Review reports and suggested corrections. Edit the project to make a
					correction, then resolve or dismiss the report.
				</p>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-3">
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
					<SelectTrigger aria-label="Filter report status" className="w-40">
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
					Refresh inbox
				</Button>
			</div>
			{search.reportId && (
				<Button
					variant="outline"
					onClick={() => onSearchChange({ status: 'open' })}
				>
					View all open reports
				</Button>
			)}
			{query.isPending ? (
				<ReportsPending />
			) : query.isError ? (
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
			) : (
				<div aria-busy={query.isFetching}>
					<ReportDataTable reports={query.data.reports} />
				</div>
			)}
			<div className="flex flex-wrap items-center justify-end gap-3">
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
			</div>
		</div>
	)
}

export function ReportsPending() {
	return (
		<output aria-label="Loading reports" className="flex flex-col gap-3">
			<Skeleton className="h-12 w-full" />
			<Skeleton className="h-64 w-full" />
		</output>
	)
}
