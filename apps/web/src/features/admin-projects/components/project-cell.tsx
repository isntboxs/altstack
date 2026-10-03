import { IconDots, IconTrash } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { FC } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
} from '@altstack/ui/components/alert-dialog'
import { Button } from '@altstack/ui/components/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '@altstack/ui/components/dropdown-menu'
import { Spinner } from '@altstack/ui/components/spinner'

import { useAdminProjectDelete } from '#/features/admin-projects/queries'

interface ProjectCellProps {
	project: ORPCRouterOutputs['admin']['project']['list']['projects'][number]
}

export const ProjectCellActions: FC<ProjectCellProps> = ({ project }) => {
	const [open, setOpen] = useState(false)

	const deleteMutation = useAdminProjectDelete()

	const handleClick = () => {
		deleteMutation.mutate(
			{ id: project.id },
			{ onSettled: () => setOpen(false) }
		)
	}

	return (
		<>
			<AlertDialog
				open={open}
				onOpenChange={(next) => {
					if (deleteMutation.isPending) return
					setOpen(next)
				}}
			>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogMedia className="bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive">
							<IconTrash />
						</AlertDialogMedia>

						<AlertDialogTitle>Delete Project</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete this project?
						</AlertDialogDescription>
					</AlertDialogHeader>

					<AlertDialogFooter>
						<AlertDialogCancel variant="outline">Cancel</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={handleClick}
							disabled={deleteMutation.isPending}
						>
							{deleteMutation.isPending ? (
								<>
									<Spinner /> Deleting
								</>
							) : (
								'Delete'
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

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

							<DropdownMenuItem
								variant="destructive"
								onClick={() => setOpen((prev) => !prev)}
							>
								Delete
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</>
	)
}
