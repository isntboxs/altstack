import { IconArrowRight, IconGitFork, IconStar } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactElement } from 'react'

import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from '@altstack/ui/components/hover-card'
import { Separator } from '@altstack/ui/components/separator'

import { ProjectLogo } from '#/components/project-media'
import { VerifiedBadge } from '#/components/verified-badge'
import type { ProjectMention } from '#/features/public-content/model'
import { resolveFileUrl } from '#/utils/storage'

const number = new Intl.NumberFormat('en-US')

export function ProjectHoverCard({
	children,
	project,
}: {
	children: ReactElement
	project: ProjectMention
}) {
	const logoUrl = resolveFileUrl(project.logo)
	const [failedLogo, setFailedLogo] = useState<string | null>(null)
	return (
		<HoverCard>
			<HoverCardTrigger delay={50} closeDelay={150} render={children} />
			<HoverCardContent
				sideOffset={8}
				alignOffset={0}
				className="not-prose w-84 max-w-[calc(100vw-1rem)] rounded-2xl border border-border bg-background p-0.5 shadow-lg ring-0"
				aria-label={`${project.name} preview`}
			>
				<Card className="relative isolate gap-0 overflow-hidden rounded-xl border border-border py-0 ring-0">
					{logoUrl && failedLogo !== logoUrl && (
						<img
							src={logoUrl}
							alt=""
							aria-hidden="true"
							className="pointer-events-none absolute -top-8 -right-10 size-40 rotate-12 mask-[linear-gradient(to_bottom,black_45%,transparent)] object-contain opacity-10"
							onError={() => setFailedLogo(logoUrl)}
						/>
					)}
					<CardHeader className="relative gap-4 px-4 pt-4">
						<div className="flex min-w-0 items-center gap-2">
							<ProjectLogo
								src={project.logo}
								name={project.name}
								className="size-7 rounded-md"
							/>
							<CardTitle className="min-w-0 truncate text-xl leading-7 font-semibold">
								{project.name} {project.verified && <VerifiedBadge />}
							</CardTitle>
						</div>
						<CardDescription className="line-clamp-2 min-h-10 text-sm leading-5">
							{project.tagline}
						</CardDescription>
					</CardHeader>
					<CardContent className="relative mt-3 flex flex-col gap-1 px-4">
						{[
							{ label: 'Stars', value: project.stars, Icon: IconStar },
							{ label: 'Forks', value: project.forks, Icon: IconGitFork },
						].map(({ label, value, Icon }) => (
							<div key={label} className="flex h-5 items-center gap-2 text-xs">
								<span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
									<Icon className="size-4" stroke={1.5} aria-hidden="true" />
									{label}
								</span>
								<Separator className="min-w-2 flex-1" />
								<span className="shrink-0 font-medium tabular-nums">
									{number.format(value)}
								</span>
							</div>
						))}
					</CardContent>
					<CardFooter className="relative border-t-0 bg-transparent px-4 pt-3 pb-3">
						<Link
							to="/$slug"
							params={{ slug: project.slug }}
							className="flex w-full items-center justify-between gap-3 text-xs leading-5 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
						>
							View project details{' '}
							<IconArrowRight
								className="size-4 text-muted-foreground"
								stroke={1.5}
								aria-hidden="true"
							/>
						</Link>
					</CardFooter>
				</Card>
			</HoverCardContent>
		</HoverCard>
	)
}
