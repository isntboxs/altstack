import { IconArrowRight, IconFolders } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { collectionKindLabels } from '@altstack/shared/schemas/collection'
import type { CollectionMention } from '@altstack/shared/schemas/collection'

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

import { ProjectLogo } from '#/components/project-media'

const number = new Intl.NumberFormat('en-US')

export function CollectionHoverCard({
	children,
	collection,
}: {
	children: ReactElement
	collection: CollectionMention
}) {
	return (
		<HoverCard>
			<HoverCardTrigger delay={50} closeDelay={150} render={children} />
			<HoverCardContent
				sideOffset={8}
				alignOffset={0}
				className="not-prose w-84 max-w-[calc(100vw-1rem)] rounded-2xl border border-border bg-background p-0.5 shadow-lg ring-0 motion-reduce:animate-none"
				aria-label={`${collection.name} collection preview`}
			>
				<Card className="gap-0 overflow-hidden rounded-xl border border-border py-0 ring-0">
					<CardHeader className="gap-4 px-4 pt-4">
						<div className="flex min-w-0 items-center gap-2">
							<ProjectLogo
								src={collection.logo}
								name={collection.name}
								className="size-7 rounded-md"
							/>
							<CardTitle className="min-w-0 text-xl leading-7 font-semibold wrap-anywhere">
								{collection.name}
							</CardTitle>
						</div>
						<CardDescription className="line-clamp-3 text-sm leading-5">
							{collection.description}
						</CardDescription>
					</CardHeader>
					<CardContent className="mt-3 flex flex-wrap items-center justify-between gap-2 px-4 text-xs text-muted-foreground">
						<span className="flex items-center gap-1.5">
							<IconFolders className="size-4" aria-hidden="true" />
							{collectionKindLabels[collection.kind]}
						</span>
						<span className="tabular-nums">
							{number.format(collection.memberCount)}{' '}
							{collection.memberCount === 1 ? 'project' : 'projects'}
						</span>
					</CardContent>
					<CardFooter className="border-t-0 bg-transparent px-4 pt-3 pb-3">
						<Link
							to="/collections/$slug"
							params={{ slug: collection.slug }}
							className="flex w-full items-center justify-between gap-3 text-xs leading-5 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
						>
							View collection details
							<IconArrowRight
								className="size-4"
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
