import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@altstack/ui/components/alert'
import { Button } from '@altstack/ui/components/button'

import {
	BookmarksPending,
	BookmarksTablePending,
} from '#/components/workspace-skeletons'
import { BookmarkDataTable } from '#/features/bookmarks/components/bookmark-data-table'
import { bookmarkQueries } from '#/features/bookmarks/queries'
import { bookmarkSearchSchema } from '#/features/bookmarks/search'
import { seoHead } from '#/features/seo/meta'

export const Route = createFileRoute('/_main/bookmarks')({
	validateSearch: bookmarkSearchSchema,
	loaderDeps: ({ search: { page, limit } }) => {
		return { page, limit }
	},
	loader: async ({ context, deps }) => {
		await context.queryClient.query(
			bookmarkQueries.list(deps, context.auth.user.id)
		)
	},
	head: () =>
		seoHead({
			title: 'Bookmarks | AltStack',
			description: 'Your saved open source projects.',
			noindex: true,
		}),
	pendingMs: 250,
	pendingMinMs: 200,
	pendingComponent: BookmarksPending,
	errorComponent: BookmarksError,
	component: BookmarksPage,
})

function BookmarksError() {
	const router = useRouter()
	return (
		<div className="flex flex-col gap-4 p-6">
			<Alert variant="destructive">
				<AlertTitle>Unable to load bookmarks</AlertTitle>
				<AlertDescription>Please try again.</AlertDescription>
			</Alert>
			<Button
				variant="outline"
				className="self-start"
				onClick={() => void router.invalidate({ sync: true })}
			>
				Retry loading
			</Button>
		</div>
	)
}

function BookmarksPage() {
	const { auth } = Route.useRouteContext()
	const search = Route.useSearch()
	const navigate = Route.useNavigate()
	const query = useQuery(bookmarkQueries.list(search, auth.user.id))
	const lastPage = query.data
		? Math.max(1, query.data.pagination.totalPages)
		: undefined
	// Removing the final row (or an unpublish) can make the current page vanish.
	useEffect(() => {
		if (lastPage !== undefined && (search.page ?? 1) > lastPage) {
			void navigate({
				search: (previous) => {
					return { ...previous, page: lastPage }
				},
				replace: true,
			})
		}
	}, [lastPage, search.page, navigate])
	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pt-4 pb-8 sm:px-6">
			<div className="flex flex-col gap-1">
				<h1 className="text-2xl font-medium tracking-tight">Bookmarks</h1>
				<p className="text-sm text-muted-foreground">
					Your saved projects. Only published projects are shown.
				</p>
			</div>
			{query.isError ? (
				<Alert variant="destructive">
					<AlertTitle>Unable to load bookmarks</AlertTitle>
					<AlertDescription>
						<Button variant="outline" onClick={() => void query.refetch()}>
							Retry loading
						</Button>
					</AlertDescription>
				</Alert>
			) : query.isPending ? (
				<BookmarksTablePending />
			) : (
				<BookmarkDataTable
					data={query.data}
					userId={auth.user.id}
					onPageChange={(page) =>
						void navigate({
							search: (previous) => {
								return { ...previous, page }
							},
						})
					}
				/>
			)}
		</div>
	)
}
