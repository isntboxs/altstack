import {
	IconArrowRight,
	IconGitCommit,
	IconLicense,
	IconStar,
} from '@tabler/icons-react'
import type { LinkComponent } from '@tanstack/react-router'
import { Link, createLink } from '@tanstack/react-router'
import type { FC, ReactNode } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from '@altstack/ui/components/pagination'
import { Separator } from '@altstack/ui/components/separator'

import { ProjectLogo } from '#/components/project-media'
import { VerifiedBadge } from '#/components/verified-badge'
import { LicenseLabel } from '#/features/project/components/license-label'
import { githubElapsed, githubFullDate } from '#/features/project/github-time'
import type { ProjectPageLinkOptions } from '#/features/project/page-links'

type ProjectCardProps =
	ORPCRouterOutputs['project']['search']['projects'][number] & { now?: number }

const CreatedPaginationPrevious = createLink(PaginationPrevious)

const CreatedPaginationNext = createLink(PaginationNext)

const CreatedPaginationLink = createLink(PaginationLink)

const CustomPaginationPrevious: LinkComponent<typeof PaginationPrevious> = (
	props
) => (
	<CreatedPaginationPrevious
		preload="intent"
		activeOptions={{ exact: true, explicitUndefined: true }}
		{...props}
	/>
)

const CustomPaginationNext: LinkComponent<typeof PaginationNext> = (props) => (
	<CreatedPaginationNext
		preload="intent"
		activeOptions={{ exact: true, explicitUndefined: true }}
		{...props}
	/>
)

const CustomPaginationLink: LinkComponent<typeof PaginationLink> = (props) => (
	<CreatedPaginationLink
		preload="intent"
		activeOptions={{ exact: true, explicitUndefined: true }}
		{...props}
	/>
)

function getPaginationItems(currentPage: number, totalPages: number) {
	if (totalPages <= 5) {
		return Array.from({ length: totalPages }, (_, i) => i + 1)
	}

	if (currentPage <= 3) {
		return [1, 2, 3, 4, 'ellipsis' as const, totalPages]
	}

	if (currentPage >= totalPages - 2) {
		return [
			1,
			'ellipsis' as const,
			totalPages - 3,
			totalPages - 2,
			totalPages - 1,
			totalPages,
		]
	}

	return [
		1,
		'ellipsis' as const,
		currentPage - 1,
		currentPage,
		currentPage + 1,
		'ellipsis' as const,
		totalPages,
	]
}

export const ProjectCard: FC<ProjectCardProps> = (projectData) => {
	const githubStatsItem = [
		{
			icon: IconStar,
			label: 'Stars',
			value: new Intl.NumberFormat('en-US', { notation: 'standard' }).format(
				projectData.github.stars
			),
		},
		{
			icon: IconGitCommit,
			label: 'Last commit',
			value: projectData.github.lastCommitAt ? (
				<time
					dateTime={projectData.github.lastCommitAt.toISOString()}
					title={githubFullDate(projectData.github.lastCommitAt)}
				>
					{githubElapsed(
						projectData.github.lastCommitAt,
						projectData.now ?? projectData.github.fetchedAt.getTime(),
						true
					)}
				</time>
			) : projectData.github.metadataFetchedAt ? (
				'No commits'
			) : (
				'Unknown'
			),
		},
		{
			icon: IconLicense,
			label: 'License',
			value: <LicenseLabel github={projectData.github} />,
		},
	]

	return (
		<article
			data-slot="project-card"
			className="group relative min-w-0 rounded-xl p-0.5 ring-1 ring-border transition-colors hover:ring-primary/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
		>
			<Card className="relative size-full overflow-hidden ring-0">
				<div
					aria-hidden="true"
					className="pointer-events-none absolute -top-10 -right-10 rotate-12 opacity-10"
				>
					<ProjectLogo
						src={projectData.logo}
						name={projectData.name}
						className="size-40 text-5xl"
					/>
				</div>
				<CardHeader className="gap-4">
					<CardTitle className="flex min-w-0 items-start gap-2">
						<ProjectLogo
							src={projectData.logo}
							name={projectData.name}
							className="size-7"
						/>
						<h2 className="min-w-0 text-xl font-semibold wrap-anywhere">
							<Link
								to="/$slug"
								params={{ slug: projectData.slug }}
								viewTransition
								className="after:absolute after:inset-0 after:z-10 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
							>
								{projectData.name} {projectData.verified && <VerifiedBadge />}
							</Link>
						</h2>
						{projectData.github.archived === true && (
							<Badge variant="secondary" className="shrink-0">
								Archived
							</Badge>
						)}
					</CardTitle>
				</CardHeader>

				<CardContent className="flex-1">
					<div className="size-full">
						<div className="flex flex-col gap-4 transition-all duration-300">
							<div className="relative min-h-10">
								<CardDescription className="wrap-anywhere transition-opacity group-hover:opacity-0">
									{projectData.tagline}
								</CardDescription>
								<p
									aria-hidden="true"
									className="pointer-events-none absolute inset-0 line-clamp-2 text-sm text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
								>
									{projectData.description}
								</p>
							</div>
							<div className="mt-auto grid grid-cols-1 gap-2">
								{githubStatsItem.map((item) => (
									<div
										key={item.label}
										className="flex items-center justify-between gap-2"
									>
										<div className="flex shrink-0 items-center gap-1.5">
											<item.icon
												aria-hidden="true"
												className="size-4 text-muted-foreground"
											/>
											<span className="text-xs text-muted-foreground">
												{item.label}
											</span>
										</div>
										<Separator className="min-w-2 flex-1" />
										<span className="min-w-0 text-right text-xs font-medium">
											{item.value}
										</span>
									</div>
								))}
							</div>
							<div className="flex items-center justify-between gap-2 text-xs font-medium text-primary">
								<span>View project details</span>
								<IconArrowRight aria-hidden="true" className="size-4" />
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		</article>
	)
}

export const ProjectListSection = ({
	data,
	emptyMessage,
	emptyAction,
	pageLinkOptions,
}: {
	data: ORPCRouterOutputs['project']['search']
	emptyMessage: string
	emptyAction?: ReactNode
	pageLinkOptions: (page: number) => ProjectPageLinkOptions
}) => {
	const { pagination } = data
	const currentPage = pagination.page || 1
	const totalPages = pagination.totalPages
	const outOfRange = currentPage > Math.max(1, totalPages)
	const paginationItems = getPaginationItems(currentPage, totalPages)
	return (
		<section
			aria-label="Project results"
			className="container mx-auto mb-10 w-full max-w-6xl space-y-4 px-4 lg:px-16"
		>
			{data.projects.length === 0 ? (
				<div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border px-4 py-12 text-center">
					<h2 className="text-lg font-medium">
						{outOfRange ? 'No projects on this page' : 'No projects found'}
					</h2>
					<p className="text-sm text-muted-foreground">
						{outOfRange
							? 'This page is beyond the available results. Return to the first page.'
							: emptyMessage}
					</p>
					{outOfRange ? (
						<Link
							{...pageLinkOptions(1)}
							resetScroll={false}
							className="inline-flex items-center underline underline-offset-4"
						>
							First page
						</Link>
					) : (
						emptyAction
					)}
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{data.projects.map((project) => (
						<ProjectCard
							key={project.slug}
							{...project}
							now={data.asOf?.getTime()}
						/>
					))}
				</div>
			)}
			{totalPages > 1 && !outOfRange && (
				<Pagination className="mt-8">
					<PaginationContent className="flex-wrap justify-center">
						<PaginationItem>
							{pagination.hasPreviousPage ? (
								<CustomPaginationPrevious
									{...pageLinkOptions(currentPage - 1)}
									resetScroll={false}
									viewTransition
								/>
							) : (
								<Button
									disabled
									variant="ghost"
									aria-label="Go to previous page"
								>
									Previous
								</Button>
							)}
						</PaginationItem>
						{paginationItems.map((item, idx) => (
							<PaginationItem key={idx}>
								{item === 'ellipsis' ? (
									<PaginationEllipsis />
								) : (
									<CustomPaginationLink
										{...pageLinkOptions(item)}
										resetScroll={false}
										isActive={item === currentPage}
										viewTransition
									>
										{item}
									</CustomPaginationLink>
								)}
							</PaginationItem>
						))}
						<PaginationItem>
							{pagination.hasNextPage ? (
								<CustomPaginationNext
									{...pageLinkOptions(currentPage + 1)}
									resetScroll={false}
									viewTransition
								/>
							) : (
								<Button disabled variant="ghost" aria-label="Go to next page">
									Next
								</Button>
							)}
						</PaginationItem>
					</PaginationContent>
				</Pagination>
			)}
		</section>
	)
}
