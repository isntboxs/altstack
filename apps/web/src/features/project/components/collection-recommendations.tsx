import { IconArrowRight } from '@tabler/icons-react'
import { Link } from '@tanstack/react-router'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { Button } from '@altstack/ui/components/button'
import { Separator } from '@altstack/ui/components/separator'

import { ProjectCard } from '#/components/project-list-section'

export function ProjectCollectionRecommendations({
	collections,
	now,
}: {
	collections: ORPCRouterOutputs['project']['getBySlug']['relatedCollections']
	now: number
}) {
	if (collections.length === 0) return null

	return (
		<div className="mt-12 flex flex-col gap-10">
			{collections.map((collection) => (
				<section
					key={collection.id}
					aria-labelledby={`collection-${collection.id}`}
					className="flex min-w-0 flex-col gap-4"
				>
					<header className="flex min-w-0 flex-wrap items-center justify-between gap-3">
						<div className="flex max-w-full min-w-0 items-center gap-4">
							<h2
								id={`collection-${collection.id}`}
								className="text-lg font-medium"
							>
								Similar open source projects
							</h2>
							<Separator className="hidden shrink-0 sm:block data-horizontal:w-16" />
						</div>
						<Button
							variant="outline"
							size="sm"
							className="max-w-full"
							render={
								<Link
									to="/collections/$slug"
									params={{ slug: collection.slug }}
								/>
							}
							title={`View collection: ${collection.name}`}
						>
							<span className="truncate">
								View collection: {collection.name}
							</span>
							<IconArrowRight data-icon="inline-end" />
						</Button>
					</header>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{collection.projects.map((project) => (
							<ProjectCard
								key={project.id}
								{...project}
								now={now}
								headingLevel="h3"
							/>
						))}
					</div>
				</section>
			))}
		</div>
	)
}
