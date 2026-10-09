import {
	IconPlus,
	IconChevronLeft,
	IconChevronRight,
	IconChevronsLeft,
	IconChevronsRight,
} from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { createColumnHelper, useTable } from '@tanstack/react-table'
import { formatDate } from 'date-fns'
import { useState } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import { Checkbox } from '@altstack/ui/components/checkbox'
import { Input } from '@altstack/ui/components/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@altstack/ui/components/select'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@altstack/ui/components/table'

import { features } from '#/utils/data-table-features'
import type { DataTableFeatures } from '#/utils/data-table-features'
import { resolveFileUrl } from '#/utils/storage'

type SubmissionList = ORPCRouterOutputs['submission']['list']
type Submission = SubmissionList['submissions'][number]
const column = createColumnHelper<DataTableFeatures, Submission>()
const statusLabels = {
	draft: 'Awaiting review',
	published: 'Published',
	rejected: 'Rejected',
	removed: 'Removed',
}
const columns = column.columns([
	column.display({
		id: 'select',
		header: ({ table }) => (
			<Checkbox
				aria-label="Select all on this page"
				checked={table.getIsAllPageRowsSelected()}
				indeterminate={
					table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
				}
				onCheckedChange={(checked) =>
					table.toggleAllPageRowsSelected(Boolean(checked))
				}
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				aria-label={`Select ${row.original.name}`}
				checked={row.getIsSelected()}
				onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
			/>
		),
	}),
	column.accessor('name', {
		header: 'Project',
		cell: ({ row: { original: submission } }) => (
			<div className="flex min-w-48 items-center gap-3">
				{submission.logo ? (
					<img
						src={resolveFileUrl(submission.logo)}
						alt=""
						className="size-8 shrink-0 rounded-md object-cover"
					/>
				) : (
					<span
						aria-hidden="true"
						className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium"
					>
						{submission.name.charAt(0).toUpperCase()}
					</span>
				)}
				<span className="font-medium">{submission.name}</span>
			</div>
		),
	}),
	column.accessor('repositoryUrl', {
		header: 'Repository',
		cell: ({ row }) => (
			<a
				href={row.original.repositoryUrl}
				target="_blank"
				rel="noopener noreferrer"
				className="text-sm text-muted-foreground underline underline-offset-4"
			>
				{row.original.repositoryUrl.replace('https://github.com/', '')}
			</a>
		),
	}),
	column.accessor('status', {
		header: 'Status',
		cell: ({ row }) => (
			<Badge
				variant={
					row.original.status === 'rejected' ? 'destructive' : 'secondary'
				}
			>
				{statusLabels[row.original.status]}
			</Badge>
		),
	}),
	column.accessor('rejectionReason', {
		header: 'Review note',
		cell: ({ row }) => (
			<p className="max-w-sm min-w-36 text-sm whitespace-normal text-muted-foreground">
				{row.original.status === 'rejected'
					? (row.original.rejectionReason ?? '—')
					: '—'}
			</p>
		),
	}),
	column.accessor('createdAt', {
		header: 'Submitted',
		cell: ({ row }) => (
			<time
				dateTime={row.original.createdAt.toISOString()}
				className="text-sm whitespace-nowrap text-muted-foreground"
			>
				{formatDate(row.original.createdAt, 'MMM d, yyyy')}
			</time>
		),
	}),
])
const pageSizes = [10, 25, 50].map((value) => {
	return { label: String(value), value }
})

export function SubmissionDataTable({
	data,
	query,
	onQueryChange,
	onPageChange,
	onPageSizeChange,
}: {
	data: SubmissionList
	query: string
	onQueryChange: (query: string) => void
	onPageChange: (page: number) => void
	onPageSizeChange: (limit: number) => void
}) {
	const [rowSelection, setRowSelection] = useState({})
	const table = useTable({
		features,
		columns,
		data: data.submissions,
		manualPagination: true,
		manualFiltering: true,
		manualSorting: true,
		getRowId: (row) => row.id,
		rowCount: data.pagination.totalItems,
		autoResetPageIndex: false,
		onRowSelectionChange: setRowSelection,
		state: {
			rowSelection,
			pagination: {
				pageIndex: data.pagination.page - 1,
				pageSize: data.pagination.limit,
			},
		},
	})
	const selected = Object.values(rowSelection).filter(Boolean).length
	const pages = Math.max(1, data.pagination.totalPages)

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Input
					aria-label="Search submissions"
					placeholder="Search..."
					value={query}
					maxLength={100}
					onChange={(event) => onQueryChange(event.target.value)}
					className="w-full sm:max-w-64"
				/>
				<Button nativeButton={false} render={<Link to="/submit" />}>
					<IconPlus /> Submit a project
				</Button>
			</div>
			<div className="overflow-hidden rounded-lg border">
				{data.submissions.length === 0 ? (
					<div className="flex min-h-28 items-center justify-center px-6 text-center text-sm text-muted-foreground">
						{query
							? 'No submissions match your search.'
							: data.pagination.page > 1
								? 'No submissions on this page. Try an earlier page.'
								: 'No submissions yet. Submit a project to get started.'}
					</div>
				) : (
					<Table aria-label="Your submissions">
						<TableHeader>
							{table.getHeaderGroups().map((group) => (
								<TableRow key={group.id}>
									{group.headers.map((header) => (
										<TableHead key={header.id}>
											{header.isPlaceholder ? null : (
												<table.FlexRender header={header} />
											)}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() ? 'selected' : undefined}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											<table.FlexRender cell={cell} />
										</TableCell>
									))}
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</div>
			<div className="flex flex-wrap items-center justify-between gap-4">
				<p className="text-sm text-muted-foreground">
					{selected} of {data.pagination.totalItems} row(s) selected.
				</p>
				<div className="flex flex-wrap items-center gap-3">
					<span className="text-sm">Per page</span>
					<Select
						items={pageSizes}
						value={data.pagination.limit}
						onValueChange={(value) => {
							if (value !== null) onPageSizeChange(value)
						}}
					>
						<SelectTrigger aria-label="Submissions per page" className="w-20">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{pageSizes.map(({ label, value }) => (
								<SelectItem key={value} value={value}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p className="min-w-24 text-sm">
						Page {data.pagination.page} of {pages}
					</p>
					<div className="flex gap-1">
						<Button
							aria-label="First page"
							variant="outline"
							size="icon-sm"
							disabled={!data.pagination.hasPreviousPage}
							onClick={() => onPageChange(1)}
						>
							<IconChevronsLeft />
						</Button>
						<Button
							aria-label="Previous page"
							variant="outline"
							size="icon-sm"
							disabled={!data.pagination.hasPreviousPage}
							onClick={() => onPageChange(data.pagination.page - 1)}
						>
							<IconChevronLeft />
						</Button>
						<Button
							aria-label="Next page"
							variant="outline"
							size="icon-sm"
							disabled={!data.pagination.hasNextPage}
							onClick={() => onPageChange(data.pagination.page + 1)}
						>
							<IconChevronRight />
						</Button>
						<Button
							aria-label="Last page"
							variant="outline"
							size="icon-sm"
							disabled={!data.pagination.hasNextPage}
							onClick={() => onPageChange(pages)}
						>
							<IconChevronsRight />
						</Button>
					</div>
				</div>
			</div>
		</div>
	)
}
