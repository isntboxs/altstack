import { IconArrowsUpDown, IconDots } from '@tabler/icons-react'
import { createColumnHelper } from '@tanstack/react-table'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import { Checkbox } from '@altstack/ui/components/checkbox'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '@altstack/ui/components/dropdown-menu'

import type { DataTableFeatures } from '#/utils/data-table-features'

export type Submission = ORPCRouterOutputs['submission']['list'][number]

const columnHelper = createColumnHelper<DataTableFeatures, Submission>()

export const submissionColumns = columnHelper.columns([
	columnHelper.display({
		id: 'select',
		header: ({ table }) => (
			<Checkbox
				checked={table.getIsAllPageRowsSelected()}
				indeterminate={
					table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
				}
				onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
				aria-label="Select all"
			/>
		),

		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
				aria-label="Select row"
			/>
		),
		enableSorting: false,
		enableHiding: false,
	}),

	columnHelper.accessor('name', {
		header: ({ column }) => (
			<Button
				variant="ghost"
				onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
			>
				Name
				<IconArrowsUpDown className="ml-2 h-4 w-4" />
			</Button>
		),
	}),

	columnHelper.accessor('repositoryUrl', {
		header: 'Repository',
	}),

	columnHelper.accessor('websiteUrl', {
		header: 'Website',
	}),

	columnHelper.accessor('status', {
		header: () => <div className="text-center">Status</div>,
		cell: ({ row }) => {
			const submission = row.original

			return (
				<div className="flex justify-center">
					<Badge variant="default">{submission.status}</Badge>
				</div>
			)
		},
	}),

	columnHelper.display({
		id: 'actions',
		header: () => <div className="text-center">Actions</div>,
		cell: ({ row }) => {
			const submission = row.original

			return (
				<div className="flex justify-center">
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<Button variant="ghost" className="h-8 w-8 p-0" />}
						>
							<span className="sr-only">Open menu</span>
							<IconDots className="h-4 w-4" />
						</DropdownMenuTrigger>

						<DropdownMenuContent align="end">
							<DropdownMenuGroup>
								<DropdownMenuLabel>Actions</DropdownMenuLabel>
							</DropdownMenuGroup>

							<DropdownMenuGroup>
								<DropdownMenuItem
									onClick={() => navigator.clipboard.writeText(submission.id)}
								>
									Copy ID
								</DropdownMenuItem>
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			)
		},
	}),
])
