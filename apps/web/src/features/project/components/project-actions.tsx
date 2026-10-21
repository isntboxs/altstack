import {
	QueryErrorResetBoundary,
	useSuspenseQuery,
} from '@tanstack/react-query'
import { CatchBoundary, useLocation } from '@tanstack/react-router'
import { Suspense, useId, useRef, useState } from 'react'
import { Bookmark, Code, Flag, More, Verified } from 'reicon-react'

import { Button } from '@altstack/ui/components/button'
import { ButtonGroup } from '@altstack/ui/components/button-group'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@altstack/ui/components/dropdown-menu'
import { Spinner } from '@altstack/ui/components/spinner'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@altstack/ui/components/tooltip'

import { AuthDialog } from '#/components/auth-dialog'
import {
	bookmarkQueries,
	useBookmarkMutation,
} from '#/features/bookmarks/queries'
import { ProjectEmbedDialog } from './project-embed-dialog'
import { ProjectReportDialog } from './project-report-dialog'

type ProjectActionsProps = {
	projectId: string
	userId: string | undefined
	slug: string
	name: string
	reportOpen: boolean
	onReportOpenChange: (open: boolean) => void
	embedOpen: boolean
	onEmbedOpenChange: (open: boolean) => void
}

type BookmarkAction = {
	saved?: boolean
	pending?: boolean
	label?: string
	onClick?: () => void
	error?: string
}

export function ProjectActions(props: ProjectActionsProps) {
	return (
		<>
			<ProjectBookmarkBoundary {...props} />
			<ProjectReportDialog
				key={props.userId ?? 'guest'}
				projectId={props.projectId}
				name={props.name}
				userId={props.userId}
				open={props.reportOpen}
				onOpenChange={props.onReportOpenChange}
				finalFocus={() => {
					const desktop = document.querySelector<HTMLButtonElement>(
						'[data-project-report]'
					)
					return desktop?.getClientRects().length
						? desktop
						: document.querySelector<HTMLButtonElement>(
								'[aria-label="More project actions"]'
							)
				}}
			/>
		</>
	)
}

function ProjectBookmarkBoundary(props: ProjectActionsProps) {
	const { projectId, userId } = props
	if (!userId) return <ProjectActionsView {...props} />

	return (
		<QueryErrorResetBoundary key={`${projectId}:${userId}`}>
			{({ reset }) => (
				<CatchBoundary
					getResetKey={() => `${projectId}:${userId}`}
					errorComponent={({ reset: resetErrorBoundary }) => (
						<ProjectActionsView
							{...props}
							bookmark={{
								label: 'Retry bookmark',
								error: 'Unable to load bookmark. Retry to refresh.',
								onClick: () => {
									reset()
									resetErrorBoundary()
								},
							}}
						/>
					)}
				>
					<Suspense
						fallback={
							<ProjectActionsView {...props} bookmark={{ pending: true }} />
						}
					>
						<ProjectBookmarkActions {...props} userId={userId} />
					</Suspense>
				</CatchBoundary>
			)}
		</QueryErrorResetBoundary>
	)
}

function ProjectBookmarkActions(
	props: ProjectActionsProps & { userId: string }
) {
	const { projectId, userId } = props
	const state = useSuspenseQuery(bookmarkQueries.state(projectId, userId))
	const mutation = useBookmarkMutation(projectId, userId)
	const saved = state.data.bookmarked
	const label = mutation.isPending
		? mutation.variables
			? 'Saving bookmark…'
			: 'Removing bookmark…'
		: state.isError
			? 'Retry bookmark'
			: saved
				? 'Remove bookmark'
				: 'Bookmark'

	return (
		<ProjectActionsView
			{...props}
			bookmark={{
				saved,
				pending: mutation.isPending,
				label,
				onClick: () => {
					if (state.isError) void state.refetch()
					else mutation.mutate(!saved)
				},
				error: state.isError
					? 'Unable to load bookmark. Retry to refresh.'
					: mutation.isError
						? 'Unable to update bookmark. Please try again.'
						: undefined,
			}}
		/>
	)
}

function ProjectActionsView({
	slug,
	name,
	embedOpen,
	onEmbedOpenChange,
	reportOpen,
	onReportOpenChange,
	bookmark,
}: ProjectActionsProps & {
	bookmark?: BookmarkAction
}) {
	const explanationId = useId()
	const moreRef = useRef<HTMLButtonElement>(null)
	const embedRef = useRef<HTMLButtonElement>(null)
	const returnFocus = useRef<HTMLElement | null>(null)
	const [authOpen, setAuthOpen] = useState(false)
	const { href } = useLocation()
	const saved = bookmark?.saved ?? false
	const bookmarkPending = bookmark?.pending ?? false
	const bookmarkLabel = bookmark?.label ?? 'Bookmark'
	const changeBookmark = () => {
		if (bookmark?.onClick) bookmark.onClick()
		else setAuthOpen(true)
	}

	return (
		<div className="ml-auto flex flex-col gap-2">
			<AuthDialog open={authOpen} onOpenChange={setAuthOpen} returnTo={href} />
			<div className="xl:hidden">
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<Button variant="outline" aria-label="More project actions">
								<More aria-hidden="true" />
								<span className="max-md:hidden">More</span>
							</Button>
						}
						ref={moreRef}
					/>
					<DropdownMenuContent align="end" className="w-60">
						<DropdownMenuGroup>
							<DropdownMenuItem disabled aria-label="Verify — Coming soon">
								<Verified aria-hidden="true" /> Verify
								<span className="ml-auto text-xs">Coming soon</span>
							</DropdownMenuItem>

							<DropdownMenuSeparator />
							<DropdownMenuItem
								disabled={bookmarkPending}
								onClick={changeBookmark}
							>
								{bookmarkPending ? (
									<Spinner />
								) : (
									<Bookmark aria-hidden="true" />
								)}
								{bookmarkLabel}
								{saved && !bookmarkPending && (
									<span className="ml-auto text-xs">Saved</span>
								)}
							</DropdownMenuItem>

							<DropdownMenuItem onClick={() => onReportOpenChange(true)}>
								<Flag aria-hidden="true" /> Report
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									returnFocus.current = moreRef.current
									onEmbedOpenChange(true)
								}}
							>
								<Code aria-hidden="true" />
								Embed
							</DropdownMenuItem>
						</DropdownMenuGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<div className="hidden flex-wrap gap-2 xl:flex">
				<Tooltip>
					<TooltipTrigger
						disabled
						render={
							<Button
								disabled
								variant="outline"
								aria-describedby={explanationId}
							>
								<Verified aria-hidden="true" />
								Verify
							</Button>
						}
					/>

					<TooltipContent>Project verification is coming soon.</TooltipContent>
				</Tooltip>

				<ButtonGroup>
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									variant={saved ? 'secondary' : 'outline'}
									aria-label={bookmarkLabel}
									aria-pressed={saved}
									aria-busy={bookmarkPending}
									disabled={bookmarkPending}
									onClick={changeBookmark}
								>
									{bookmarkPending ? (
										<Spinner />
									) : (
										<Bookmark aria-hidden="true" />
									)}
								</Button>
							}
						/>
						<TooltipContent>
							{saved ? 'Remove from your bookmarks' : 'Bookmark this project'}
						</TooltipContent>
					</Tooltip>
					<Tooltip>
						<TooltipTrigger
							render={
								<Button
									data-project-report
									variant="outline"
									aria-label="Report"
									aria-haspopup="dialog"
									aria-expanded={reportOpen}
									onClick={() => onReportOpenChange(true)}
								>
									<Flag aria-hidden="true" />
								</Button>
							}
						/>
						<TooltipContent>Send a report/suggestion</TooltipContent>
					</Tooltip>
					<Button
						ref={embedRef}
						variant="outline"
						aria-label="Embed"
						aria-haspopup="dialog"
						aria-expanded={embedOpen}
						onClick={() => {
							returnFocus.current = embedRef.current
							onEmbedOpenChange(true)
						}}
					>
						<Code aria-hidden="true" />
					</Button>
				</ButtonGroup>
			</div>
			<p
				id={explanationId}
				className="hidden text-xs text-muted-foreground xl:block"
			>
				Verify is coming soon.
			</p>
			{bookmark?.error && (
				<p role="alert" className="max-w-60 text-xs text-destructive">
					{bookmark.error}
				</p>
			)}
			<ProjectEmbedDialog
				slug={slug}
				name={name}
				open={embedOpen}
				onOpenChange={onEmbedOpenChange}
				finalFocus={() => {
					const previous = returnFocus.current
					if (previous?.getClientRects().length) return previous
					return window.matchMedia('(min-width: 1280px)').matches
						? embedRef.current
						: moreRef.current
				}}
			/>
		</div>
	)
}
