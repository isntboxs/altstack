import {
	IconArrowLeft,
	IconArrowRight,
	IconExternalLink,
	IconFolders,
	IconPencil,
	IconPlus,
	IconTrash,
} from '@tabler/icons-react'
import {
	useMutation,
	useSuspenseQuery,
	useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, startTransition } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { collectionKindLabels } from '@altstack/shared/schemas/collection'

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@altstack/ui/components/alert'
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
import { Badge } from '@altstack/ui/components/badge'
import { Button, buttonVariants } from '@altstack/ui/components/button'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@altstack/ui/components/empty'
import { Skeleton } from '@altstack/ui/components/skeleton'
import { toast } from '@altstack/ui/components/toast'

import { PublicError } from '#/components/public-page-state'
import { QueryBoundary } from '#/components/query-boundary'
import { adminCollectionQueries } from '#/features/collections/queries'
import { orpc } from '#/utils/orpc'

export const Route = createFileRoute('/_main/admin/collections/')({
	loader: ({ context }) =>
		context.queryClient.query(adminCollectionQueries.list()),
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: CollectionListPending,
	errorComponent: () => <PublicError title="Unable to load collections" />,
	component: Page,
})

type Collection =
	ORPCRouterOutputs['admin']['collection']['list']['collections'][number]

function CollectionListPending() {
	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
			<output className="sr-only">Loading collections…</output>
			<Skeleton className="h-8 w-48" />
			<Skeleton className="h-5 w-64 max-w-full" />
			{[0, 1, 2].map((row) => (
				<Skeleton key={row} className="h-36 w-full rounded-xl" />
			))}
		</div>
	)
}

function Page() {
	return (
		<QueryBoundary pending={<CollectionListPending />}>
			<CollectionList />
		</QueryBoundary>
	)
}

function CollectionList() {
	const [page, setPage] = useState(1)
	const [error, setError] = useState('')
	const [deleting, setDeleting] = useState<Collection | null>(null)
	const queryClient = useQueryClient()
	const query = useSuspenseQuery(adminCollectionQueries.list(page))
	const remove = useMutation({
		...orpc.admin.collection.delete.mutationOptions(),
		onSuccess: async () => {
			setDeleting(null)
			setError('')
			if (query.data.collections.length === 1 && page > 1) {
				startTransition(() => setPage(page - 1))
			}
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: orpc.admin.collection.key(),
				}),
				queryClient.invalidateQueries({ queryKey: orpc.collection.key() }),
			])
			toast.add({ type: 'success', title: 'Collection deleted' })
		},
		onError: async (err) => {
			setDeleting(null)
			setError(err.message)
			await queryClient.invalidateQueries({
				queryKey: orpc.admin.collection.key(),
			})
		},
	})
	const total = query.data.total
	const pageCount = Math.max(1, Math.ceil(total / 20))

	return (
		<div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex min-w-0 flex-col gap-2">
					<h1 className="text-2xl font-semibold tracking-tight">Collections</h1>
					<p className="max-w-xl text-sm text-muted-foreground">
						Curate projects into useful lists, alternatives, and ecosystems for
						the community.
					</p>
				</div>
				<Link to="/admin/collections/create" className={buttonVariants()}>
					<IconPlus data-icon="inline-start" />
					Create collection
				</Link>
			</header>
			{error && (
				<Alert variant="destructive">
					<AlertTitle>Unable to delete collection</AlertTitle>
					<AlertDescription>
						{error} The list has been refreshed. Review the collection before
						trying again.
					</AlertDescription>
				</Alert>
			)}
			{query.isError && (
				<Alert variant="destructive">
					<AlertTitle>Unable to load collections</AlertTitle>
					<AlertDescription>
						<p>Your collections could not be loaded. Please try again.</p>
						<Button variant="outline" onClick={() => void query.refetch()}>
							Retry
						</Button>
					</AlertDescription>
				</Alert>
			)}
			<section
				aria-label="Collection directory"
				className="overflow-hidden rounded-xl border bg-card"
			>
				<div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3 sm:px-5">
					<h2 className="text-sm font-medium">
						All collections{' '}
						<span className="ml-1 text-muted-foreground">({total})</span>
					</h2>
					<p className="text-xs text-muted-foreground">
						Drafts are only visible to admins
					</p>
				</div>
				<ul className="divide-y">
					{query.data.collections.map((item) => (
						<li key={item.id} className="flex flex-col gap-4 p-4 sm:p-5">
							<div className="flex items-start gap-3">
								<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
									<IconFolders className="size-5" aria-hidden="true" />
								</div>
								<div className="flex min-w-0 flex-1 flex-col gap-1.5">
									<div className="flex flex-wrap items-center gap-2">
										<Link
											to="/admin/collections/$id/edit"
											params={{ id: item.id }}
											className="rounded-sm font-medium wrap-anywhere underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
										>
											{item.name}
										</Link>
										<Badge
											variant={
												item.status === 'published' ? 'default' : 'secondary'
											}
										>
											{item.status === 'published' ? 'Published' : 'Draft'}
										</Badge>
									</div>
									<p className="line-clamp-2 text-sm wrap-anywhere text-muted-foreground">
										{item.description}
									</p>
									<p className="truncate text-xs text-muted-foreground">
										/collections/{item.slug}
									</p>
								</div>
							</div>
							<div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 sm:pl-13">
								<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
									<span>{collectionKindLabels[item.kind]}</span>
									<span className="wrap-anywhere">By {item.authorName}</span>
									<time dateTime={new Date(item.updatedAt).toISOString()}>
										Updated{' '}
										{new Date(item.updatedAt).toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric',
											year: 'numeric',
											timeZone: 'UTC',
										})}
									</time>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									{item.status === 'published' && (
										<Link
											to="/collections/$slug"
											params={{ slug: item.slug }}
											className={buttonVariants({
												variant: 'ghost',
												size: 'sm',
											})}
										>
											<IconExternalLink data-icon="inline-start" />
											View public page
										</Link>
									)}
									<Link
										to="/admin/collections/$id/edit"
										params={{ id: item.id }}
										className={buttonVariants({
											variant: 'outline',
											size: 'sm',
										})}
									>
										<IconPencil data-icon="inline-start" />
										Edit<span className="sr-only"> {item.name}</span>
									</Link>
									<Button
										variant="ghost"
										size="icon-sm"
										aria-label={`Delete ${item.name}`}
										disabled={remove.isPending}
										onClick={() => setDeleting(item)}
									>
										<IconTrash />
									</Button>
								</div>
							</div>
						</li>
					))}
				</ul>
				{query.data.collections.length === 0 && (
					<Empty className="py-16">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<IconFolders />
							</EmptyMedia>
							<EmptyTitle>No collections yet</EmptyTitle>
							<EmptyDescription>
								No collections. Create the first collection to begin curating.
							</EmptyDescription>
						</EmptyHeader>
						<Link
							to="/admin/collections/create"
							className={buttonVariants({ variant: 'outline' })}
						>
							<IconPlus data-icon="inline-start" />
							Create collection
						</Link>
					</Empty>
				)}
				{total > 0 && (
					<nav
						aria-label="Collection pagination"
						className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5"
					>
						<p className="text-xs text-muted-foreground">
							Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of{' '}
							{total}
						</p>
						<div className="flex items-center gap-3">
							<Button
								variant="outline"
								size="sm"
								disabled={page === 1 || query.isFetching}
								onClick={() => startTransition(() => setPage(page - 1))}
							>
								<IconArrowLeft data-icon="inline-start" />
								Previous
							</Button>
							<span className="text-xs text-muted-foreground">
								{page} / {pageCount}
							</span>
							<Button
								variant="outline"
								size="sm"
								disabled={page >= pageCount || query.isFetching}
								onClick={() => startTransition(() => setPage(page + 1))}
							>
								Next
								<IconArrowRight data-icon="inline-end" />
							</Button>
						</div>
					</nav>
				)}
			</section>
			<AlertDialog
				open={!!deleting}
				onOpenChange={(open) => {
					if (!open && !remove.isPending) setDeleting(null)
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete collection?</AlertDialogTitle>
						<AlertDialogDescription className="wrap-anywhere">
							“{deleting?.name}” will be permanently deleted. The projects in
							this collection will be kept. This cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={remove.isPending}>
							Keep collection
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={remove.isPending}
							onClick={() => {
								if (deleting) {
									setError('')
									remove.mutate({
										params: { id: deleting.id },
										body: { expectedVersion: deleting.version },
									})
								}
							}}
						>
							{remove.isPending ? 'Deleting…' : 'Delete collection'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	)
}
