import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@altstack/ui/components/alert-dialog'
import { Button } from '@altstack/ui/components/button'

import { categoryDeletionReason } from '#/features/admin-categories/model'
import type { AdminCategory } from '#/features/admin-categories/model'
import {
	adminCategoryQueries,
	useAdminCategoryDelete,
} from '#/features/admin-categories/queries'

export function CategoryActions({
	category,
	categories,
}: {
	category: AdminCategory
	categories: Array<AdminCategory>
}) {
	const [open, setOpen] = useState(false)
	const queryClient = useQueryClient()
	const mutation = useAdminCategoryDelete()
	const reason = categoryDeletionReason(category, categories)
	return (
		<div className="flex items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				nativeButton={false}
				render={
					<Link to="/admin/categories/$id/edit" params={{ id: category.id }} />
				}
			>
				Edit<span className="sr-only"> {category.name}</span>
			</Button>
			<Button
				variant="ghost"
				size="sm"
				aria-label={`Delete ${category.name}`}
				onClick={() => {
					mutation.reset()
					setOpen(true)
				}}
			>
				Delete<span className="sr-only"> {category.name}</span>
			</Button>
			<AlertDialog
				open={open}
				onOpenChange={(next) => {
					if (!mutation.isPending) setOpen(next)
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {category.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							{reason ??
								'This permanently deletes the category. This action cannot be undone.'}
						</AlertDialogDescription>
					</AlertDialogHeader>
					{mutation.error && (
						<p role="alert" className="text-sm text-destructive">
							{mutation.error.message} Refresh the list to review children and
							assignments, or retry.
						</p>
					)}
					{mutation.error && (
						<Button
							variant="outline"
							disabled={mutation.isPending}
							onClick={() =>
								void queryClient.invalidateQueries({
									queryKey: adminCategoryQueries.list().queryKey,
								})
							}
						>
							Refresh categories
						</Button>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={mutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={!!reason || mutation.isPending}
							onClick={() =>
								mutation.mutate(
									{ id: category.id },
									{ onSuccess: () => setOpen(false) }
								)
							}
						>
							{mutation.isPending ? 'Deleting…' : 'Delete category'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
