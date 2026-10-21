import { useState } from 'react'

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

import { ReportDataTable } from '#/features/admin-reports/components/report-data-table'
import { useAdminReportList } from '#/features/admin-reports/queries'

const statusItems = [...reportStatuses, { value: 'all', label: 'All statuses' }]

export function ReportInbox() {
	const [status, setStatus] = useState('open')
	const [cursors, setCursors] = useState<Array<string | undefined>>([undefined])
	const query = useAdminReportList(
		adminListReportsQuerySchema.parse({ status, cursor: cursors.at(-1) })
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
						setStatus(value)
						setCursors([undefined])
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
						setCursors([undefined])
						if (cursors.length === 1) void query.refetch()
					}}
				>
					Refresh inbox
				</Button>
			</div>
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
					Newest first · Page {cursors.length}
				</p>
				<Button
					variant="outline"
					size="sm"
					disabled={cursors.length === 1 || query.isFetching}
					onClick={() => setCursors((previous) => previous.slice(0, -1))}
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
						if (cursor) setCursors((previous) => [...previous, cursor])
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
