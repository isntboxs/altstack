import type { ComponentProps } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { featuredWebsiteUrl } from '@altstack/shared/schemas/featured'

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'

import { ProjectHoverCard } from '#/components/project-hover-card'
import { ProjectLogo } from '#/components/project-media'
import { DetailAd } from '#/features/ads/components'
import { useAds } from '#/features/ads/context'
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
	const hasAd = useAds('project-detail').length > 0
	const visible = projects.filter((project) =>
		featuredWebsiteUrl(project.websiteUrl)
	)
	return (
		<aside className="flex min-w-0 flex-col gap-8" aria-label="Project sidebar">
			<GithubStatistics
				{...statistics}
				sticky={visible.length === 0 && !hasAd}
				className={visible.length > 0 ? 'order-2 md:order-1' : 'flex-1'}
			/>
			{(hasAd || visible.length > 0) && (
				<div
					className="order-1 flex flex-col gap-6 md:sticky md:top-17 md:order-2"
					data-featured-panel
				>
					<DetailAd kind="project-detail" />
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
		<Card aria-label="Featured projects" className="@container/featured">
			<CardHeader className="px-3">
				<CardTitle>Featured Projects</CardTitle>
			</CardHeader>
			<CardContent className="px-3">
				<ul
					className="grid grid-cols-1 gap-1.5 @min-[118px]/featured:grid-cols-2 @min-[168px]/featured:grid-cols-3 @min-[218px]/featured:grid-cols-4 @min-[318px]/featured:grid-cols-6"
					aria-label="Featured project websites"
				>
					{visible.map((project) => (
						<li key={project.id} className="min-w-0">
							<ProjectHoverCard project={project}>
								<a
									href={project.websiteUrl}
									target="_blank"
									rel="noopener noreferrer"
									aria-label={`Visit ${project.name} website (opens in a new tab)`}
									className="flex aspect-square w-full items-center justify-center rounded-lg border bg-background/50 transition-colors hover:border-foreground/25 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
								>
									<ProjectLogo
										src={project.logo}
										name={project.name}
										className="size-7 rounded-md bg-transparent"
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
