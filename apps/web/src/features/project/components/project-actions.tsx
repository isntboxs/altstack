import { useId } from 'react'
import { Bookmark, Code, Flag, More, Verified } from 'reicon-react'

import { Button } from '@altstack/ui/components/button'
import { ButtonGroup } from '@altstack/ui/components/button-group'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@altstack/ui/components/dropdown-menu'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@altstack/ui/components/tooltip'

const deferredActions = [
	{ label: 'Bookmark', description: 'Bookmark this project', Icon: Bookmark },
	{ label: 'Report', description: 'Send a report/suggestion', Icon: Flag },
	{ label: 'Embed', description: 'Embed on your website', Icon: Code },
]

export function ProjectActions() {
	const explanationId = useId()

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
					/>
					<DropdownMenuContent align="end" className="w-60">
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
				</ButtonGroup>
			</div>
			<p
				id={explanationId}
				className="hidden text-xs text-muted-foreground xl:block"
			>
				These actions are coming soon.
			</p>
		</div>
	)
}
