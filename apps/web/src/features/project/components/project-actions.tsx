import { useId, useRef } from 'react'
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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@altstack/ui/components/tooltip'

import { ProjectEmbedDialog } from './project-embed-dialog'

const deferredActions = [
	{ label: 'Bookmark', description: 'Bookmark this project', Icon: Bookmark },
	{ label: 'Report', description: 'Send a report/suggestion', Icon: Flag },
]

export function ProjectActions({
	slug,
	name,
	embedOpen,
	onEmbedOpenChange,
}: {
	slug: string
	name: string
	embedOpen: boolean
	onEmbedOpenChange: (open: boolean) => void
}) {
	const explanationId = useId()
	const moreRef = useRef<HTMLButtonElement>(null)
	const embedRef = useRef<HTMLButtonElement>(null)
	const returnFocus = useRef<HTMLElement | null>(null)

	return (
		<div className="ml-auto space-y-2">
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
				Verify, Bookmark and Report are coming soon.
			</p>
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
