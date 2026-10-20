import { useQuery } from '@tanstack/react-query'
import { useLocation } from '@tanstack/react-router'
import { useId, useRef, useState } from 'react'
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

const deferredActions = [
	{ label: 'Report', description: 'Send a report/suggestion', Icon: Flag },
]

export function ProjectActions({
	projectId,
	userId,
	slug,
	name,
	embedOpen,
	onEmbedOpenChange,
}: {
	projectId: string
	userId: string | undefined
	slug: string
	name: string
	embedOpen: boolean
	onEmbedOpenChange: (open: boolean) => void
}) {
	const explanationId = useId()
	const moreRef = useRef<HTMLButtonElement>(null)
	const embedRef = useRef<HTMLButtonElement>(null)
	const returnFocus = useRef<HTMLElement | null>(null)
	const [authOpen, setAuthOpen] = useState(false)
	const { href } = useLocation()
	const state = useQuery(bookmarkQueries.state(projectId, userId))
	const mutation = useBookmarkMutation(projectId, userId)
	const saved = !!userId && !!state.data?.bookmarked
	const bookmarkPending = !!userId && (state.isPending || mutation.isPending)
	const bookmarkLabel = mutation.isPending
		? mutation.variables
			? 'Saving bookmark…'
			: 'Removing bookmark…'
		: userId && state.isError
			? 'Retry bookmark'
			: saved
				? 'Remove bookmark'
				: 'Bookmark'
	const changeBookmark = () => {
		if (!userId) setAuthOpen(true)
		else if (state.isError) void state.refetch()
		else mutation.mutate(!saved)
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
								{saved && !mutation.isPending && (
									<span className="ml-auto text-xs">Saved</span>
								)}
							</DropdownMenuItem>

							{deferredActions.map(({ label, Icon }) => (
								<DropdownMenuItem
									key={label}
									disabled
									aria-label={`${label} — Coming soon`}
								>
									<Icon aria-hidden="true" />
									{label}
									<span className="ml-auto text-xs">Coming soon</span>
								</DropdownMenuItem>
							))}
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
					{deferredActions.map(({ label, description, Icon }) => (
						<Tooltip key={label}>
							<TooltipTrigger
								disabled
								render={
									<Button
										disabled
										variant="outline"
										aria-label={label}
										aria-describedby={explanationId}
									>
										<Icon aria-hidden="true" />
									</Button>
								}
							/>

							<TooltipContent>{description}</TooltipContent>
						</Tooltip>
					))}
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
				Verify and Report are coming soon.
			</p>
			{userId && (state.isError || mutation.isError) && (
				<p role="alert" className="max-w-60 text-xs text-destructive">
					{state.isError
						? 'Unable to load bookmark. Retry to refresh.'
						: 'Unable to update bookmark. Please try again.'}
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
