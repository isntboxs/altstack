import {
	IconChevronLeft,
	IconChevronRight,
	IconBookmark,
} from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { Button } from '@altstack/ui/components/button'
import {
	Empty,
	EmptyHeader,
	EmptyTitle,
	EmptyDescription,
	EmptyMedia,
} from '@altstack/ui/components/empty'
import { Spinner } from '@altstack/ui/components/spinner'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@altstack/ui/components/table'

import { ProjectLogo } from '#/components/project-media'
import { useBookmarkMutation } from '#/features/bookmarks/queries'

type BookmarkList = ORPCRouterOutputs['bookmark']['list']

export function BookmarkDataTable({
	data,
	userId,
	onPageChange,
}: {
	data: BookmarkList
	userId: string
	onPageChange: (page: number) => void
}) {
	const { pagination } = data
	return (
		<div className="flex flex-col gap-4">
			<div className="overflow-hidden rounded-lg border">
				<Table aria-label="Your bookmarks">
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Description</TableHead>
							<TableHead className="w-28">Action</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.bookmarks.map((project) => (
							<TableRow key={project.id}>
								<TableCell>
									<Link
										to="/$slug"
										params={{ slug: project.slug }}
										className="flex min-w-40 items-center gap-3 font-medium hover:underline"
									>
										<ProjectLogo
											src={project.logo}
											name={project.name}
											className="size-8"
										/>
										<span className="max-w-64 truncate">{project.name}</span>
									</Link>
								</TableCell>
								<TableCell className="min-w-40 whitespace-normal text-muted-foreground">
									{project.tagline ?? '—'}
								</TableCell>
								<TableCell>
									<RemoveBookmark
										id={project.id}
										name={project.name}
										userId={userId}
									/>
								</TableCell>
							</TableRow>
						))}
						{data.bookmarks.length === 0 && (
							<TableRow>
								<TableCell colSpan={3}>
									<Empty>
										<EmptyHeader>
											<EmptyMedia variant="icon">
												<IconBookmark />
											</EmptyMedia>
											<EmptyTitle>
												{pagination.page > 1
													? 'No bookmarks on this page'
													: 'No bookmarks yet'}
											</EmptyTitle>
											<EmptyDescription>
												{pagination.page > 1
													? 'Try an earlier page.'
													: 'Save projects using Bookmark on their project page. Only published projects appear here.'}
											</EmptyDescription>
										</EmptyHeader>
									</Empty>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<div className="flex flex-wrap items-center justify-between gap-4">
				<p className="text-sm text-muted-foreground">
					{pagination.totalItems} bookmark(s)
				</p>
				<div className="flex items-center gap-3">
					<p className="text-sm">
						Page {pagination.page} of {Math.max(1, pagination.totalPages)}
					</p>
					<Button
						aria-label="Previous page"
						variant="outline"
						size="icon-sm"
						disabled={!pagination.hasPreviousPage}
						onClick={() => onPageChange(pagination.page - 1)}
					>
						<IconChevronLeft />
					</Button>
					<Button
						aria-label="Next page"
						variant="outline"
						size="icon-sm"
						disabled={!pagination.hasNextPage}
						onClick={() => onPageChange(pagination.page + 1)}
					>
						<IconChevronRight />
					</Button>
				</div>
			</div>
		</div>
	)
}

function RemoveBookmark({
	id,
	name,
	userId,
}: {
	id: string
	name: string
	userId: string
}) {
	const mutation = useBookmarkMutation(id, userId)
	return (
		<div className="flex flex-col gap-2">
			<Button
				variant="outline"
				size="sm"
				aria-label={`Remove ${name} from bookmarks`}
				aria-busy={mutation.isPending}
				disabled={mutation.isPending}
				onClick={() => mutation.mutate(false)}
			>
				{mutation.isPending && <Spinner data-icon="inline-start" />}
				{mutation.isPending ? 'Removing…' : 'Remove'}
			</Button>
			{mutation.isError && (
				<p role="alert" className="text-xs text-destructive">
					Unable to remove. Try again.
				</p>
			)}
		</div>
	)
}
