import type { ComponentProps } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { featuredWebsiteUrl } from '@altstack/shared/schemas/featured'

import { buttonVariants } from '@altstack/ui/components/button'
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'

import { ProjectHoverCard } from '#/components/project-hover-card'
import { ProjectLogo } from '#/components/project-media'
import { GithubStatistics } from '#/features/project/components/github-statistics'

export type FeaturedProjectsData =
	ORPCRouterOutputs['project']['getBySlug']['featuredProjects']

export function ProjectSidebar({
	projects,
	...statistics
}: { projects: FeaturedProjectsData } & Omit<
	ComponentProps<typeof GithubStatistics>,
	'sticky' | 'className'
>) {
	const visible = projects.filter((project) =>
		featuredWebsiteUrl(project.websiteUrl)
	)
	return (
		<aside className="flex min-w-0 flex-col gap-8" aria-label="Project sidebar">
			<GithubStatistics
				{...statistics}
				sticky={visible.length === 0}
				className={visible.length > 0 ? 'order-2 md:order-1' : 'flex-1'}
			/>
			{visible.length > 0 && (
				<div
					className="order-1 md:sticky md:top-17 md:order-2"
					data-featured-panel
				>
					<FeaturedProjects projects={visible} />
				</div>
			)}
		</aside>
	)
}

export function FeaturedProjects({
	projects,
}: {
	projects: FeaturedProjectsData
}) {
	const visible = projects.filter((project) =>
		featuredWebsiteUrl(project.websiteUrl)
	)
	if (visible.length === 0) return null
	return (
		<Card aria-label="Featured projects">
			<CardHeader>
				<CardTitle>Featured Projects</CardTitle>
			</CardHeader>
			<CardContent>
				<ul
					className="flex flex-wrap gap-2"
					aria-label="Featured project websites"
				>
					{visible.map((project) => (
						<li key={project.id}>
							<ProjectHoverCard project={project}>
								<a
									href={project.websiteUrl}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={`Visit ${project.name} website (opens in a new tab)`}
									className={buttonVariants({
										variant: 'outline',
										size: 'icon',
										className: 'size-11',
									})}
								>
									<ProjectLogo
										src={project.logo}
										name={project.name}
										className="size-6"
									/>
								</a>
							</ProjectHoverCard>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	)
}
