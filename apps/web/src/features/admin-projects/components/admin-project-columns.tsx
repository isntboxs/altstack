import { IconArrowsUpDown, IconDots } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { createColumnHelper } from '@tanstack/react-table'
import { formatDate } from 'date-fns'

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

import { useAdminProjectDelete } from '#/features/admin-projects/queries'
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
							to="/$slug"
							params={{ slug: project.slug }}
							viewTransition
						/>
					}
					nativeButton={false}
				>
					<img
						src={resolveFileUrl(project.logo)}
						alt={`${project.name} logo`}
						className="size-4 rounded"
					/>
					{project.name}
				</Button>
			)
		},
	}),

	columnHelper.accessor('tagline', {
		header: 'Tagline',
		cell: ({ row }) => {
			const project = row.original

			return <p className="w-full max-w-xs truncate">{project.tagline}</p>
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
									onClick={() => navigator.clipboard.writeText(project.id)}
								>
									Copy ID
								</DropdownMenuItem>

								<DropdownMenuItem
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
									Edit
								</DropdownMenuItem>

								<DeleteProjectButton id={project.id} />
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			)
		},
	}),
])

const DeleteProjectButton = ({ id }: { id: string }) => {
	const deleteMutation = useAdminProjectDelete()

	const handleClick = () => {
		deleteMutation.mutate({ id })
	}

	return (
		<DropdownMenuItem variant="destructive" onClick={handleClick}>
			Delete
		</DropdownMenuItem>
	)
}
