import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'

import { collectionKindLabels } from '@altstack/shared/schemas/collection'

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@altstack/ui/components/alert'
import { Button, buttonVariants } from '@altstack/ui/components/button'

import { PublicPending, PublicError } from '#/components/public-page-state'
import { adminCollectionQueries } from '#/features/collections/queries'
import { orpc } from '#/utils/orpc'

export const Route = createFileRoute('/_main/admin/collections/')({
	loader: ({ context }) =>
		context.queryClient.query(adminCollectionQueries.list()),
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: PublicPending,
	errorComponent: () => <PublicError title="Unable to load collections" />,
	component: Page,
})
function Page() {
	const [page, setPage] = useState(1),
		[error, setError] = useState(''),
		queryClient = useQueryClient()
	const query = useQuery(adminCollectionQueries.list(page))
	const remove = useMutation({
		...orpc.admin.collection.delete.mutationOptions(),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: orpc.admin.collection.key(),
				}),
				queryClient.invalidateQueries({ queryKey: orpc.collection.key() }),
			])
		},
		onError: (err) => setError(err.message),
	})
	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<h1 className="text-2xl font-semibold">Collections</h1>
				<Link to="/admin/collections/create" className={buttonVariants()}>
					Create collection
				</Link>
			</div>
			<p className="text-sm text-muted-foreground">
				Public, manually curated discovery pages. Private bookmarks are
				separate.
			</p>
			{error && (
				<Alert variant="destructive">
					<AlertTitle>Unable to delete collection</AlertTitle>
					<AlertDescription>
						{error} Reload the list before retrying.
					</AlertDescription>
				</Alert>
			)}
			{query.isError && (
				<Alert variant="destructive">
					<AlertTitle>Unable to load collections</AlertTitle>
					<AlertDescription>
						<Button variant="outline" onClick={() => void query.refetch()}>
							Retry
						</Button>
					</AlertDescription>
				</Alert>
			)}
			{query.isPending && <output>Loading collections…</output>}
			<ul className="flex flex-col gap-3">
				{query.data?.collections.map((item) => (
					<li
						key={item.id}
						className="flex flex-wrap items-center gap-4 rounded-md border p-4"
					>
						<div className="mr-auto flex min-w-0 flex-col gap-1">
							<Link
								to="/admin/collections/$id/edit"
								params={{ id: item.id }}
								className="font-medium underline underline-offset-4"
							>
								{item.name}
							</Link>
							<p className="text-sm text-muted-foreground">
								{collectionKindLabels[item.kind]} · {item.status}
							</p>
						</div>
						<Link
							to="/collections/$slug"
							params={{ slug: item.slug }}
							className={buttonVariants({ variant: 'outline' })}
						>
							View public page
						</Link>
						<Button
							variant="destructive"
							disabled={remove.isPending}
							onClick={() => {
								if (
									window.confirm(
										`Delete “${item.name}”? This cannot be undone.`
									)
								) {
									setError('')
									remove.mutate({
										params: { id: item.id },
										body: { expectedVersion: item.version },
									})
								}
							}}
						>
							Delete
						</Button>
					</li>
				))}
			</ul>
			{query.data?.collections.length === 0 && (
				<p>No collections. Create the first collection to begin curating.</p>
			)}
			<div className="flex gap-3">
				<Button
					variant="outline"
					disabled={page === 1}
					onClick={() => setPage(page - 1)}
				>
					Previous
				</Button>
				<span className="self-center text-sm">Page {page}</span>
				<Button
					variant="outline"
					disabled={!query.data || page * 20 >= query.data.total}
					onClick={() => setPage(page + 1)}
				>
					Next
				</Button>
			</div>
		</div>
	)
}
