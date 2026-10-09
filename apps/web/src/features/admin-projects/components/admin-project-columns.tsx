import { IconArrowsUpDown } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { createColumnHelper } from '@tanstack/react-table'
import { formatDate } from 'date-fns'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import { Checkbox } from '@altstack/ui/components/checkbox'

import { ProjectCellActions } from '#/features/admin-projects/components/project-cell'
import type { DataTableFeatures } from '#/utils/data-table-features'
import { resolveFileUrl } from '#/utils/storage'

export type AdminProject =
	ORPCRouterOutputs['admin']['project']['list']['projects'][number]

const columnHelper = createColumnHelper<DataTableFeatures, AdminProject>()

export const adminProjectColumns = columnHelper.columns([
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
				<IconArrowsUpDown className="size-4" />
			</Button>
		),
		cell: ({ row }) => {
			const project = row.original

			return (
				<Button
					variant="link"
					render={
						<Link
							from="/projects"
							to="/projects/$id/edit"
							params={{ id: project.id }}
							viewTransition
						/>
					}
					nativeButton={false}
				>
					{project.logo ? (
						<img
							src={resolveFileUrl(project.logo)}
							alt={`${project.name} logo`}
							className="size-4 rounded"
						/>
					) : (
						<span
							aria-hidden="true"
							className="flex size-5 items-center justify-center rounded bg-muted text-xs"
						>
							{project.name.charAt(0).toUpperCase()}
						</span>
					)}
					{project.name}
				</Button>
			)
		},
	}),

	columnHelper.accessor('tagline', {
		header: 'Tagline',
		cell: ({ row }) => {
			const project = row.original

			return (
				<p className="w-full max-w-xs truncate">
					{project.tagline ?? 'Awaiting content'}
				</p>
			)
		},
	}),

	columnHelper.accessor('status', {
		header: () => <div className="text-center">Status</div>,
		cell: ({ row }) => {
			const project = row.original

			return (
				<div className="flex justify-center">
					<Badge variant="default">{project.status}</Badge>
				</div>
			)
		},
	}),

	columnHelper.display({
		id: 'submitter',
		header: 'Submitted by',
		cell: ({ row }) =>
			row.original.submitter ? (
				<div className="text-sm">
					<p>{row.original.submitter.name}</p>
					<p className="text-xs text-muted-foreground">
						{row.original.submitter.email}
					</p>
				</div>
			) : (
				<span className="text-muted-foreground">Admin</span>
			),
	}),

	columnHelper.accessor('createdAt', {
		header: () => <p className="text-center">Created At</p>,
		cell: ({ row }) => {
			const project = row.original

			return (
				<p className="text-center">{formatDate(project.createdAt, 'PPP')}</p>
			)
		},
	}),

	columnHelper.accessor('updatedAt', {
		header: () => <p className="text-center">Updated At</p>,
		cell: ({ row }) => {
			const project = row.original

			return (
				<p className="text-center">{formatDate(project.updatedAt, 'PPP')}</p>
			)
		},
	}),

	columnHelper.display({
		id: 'actions',
		header: () => <div className="text-center">Actions</div>,
		cell: ({ row }) => {
			const project = row.original

			return <ProjectCellActions project={project} />
		},
	}),
])
