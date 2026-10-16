import { IconArrowRight, IconGitFork, IconStar } from '@tabler/icons-react'
import type { LinkComponent } from '@tanstack/react-router'
import { Link, createLink } from '@tanstack/react-router'
import type { FC, ReactNode } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

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
import type { ProjectPageLinkOptions } from '#/features/project/page-links'

type ProjectCardProps =
	ORPCRouterOutputs['project']['search']['projects'][number]

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

const ProjectCard: FC<ProjectCardProps> = (projectData) => {
	const githubStatsItem = [
		{
			icon: IconStar,
			label: 'Stars',
			value: new Intl.NumberFormat('en-US', { notation: 'standard' }).format(
				projectData.github.stars
			),
		},
		{
			icon: IconGitFork,
			label: 'Forks',
			value: new Intl.NumberFormat('en-US', { notation: 'standard' }).format(
				projectData.github.forks
			),
		},
	]

	return (
		<Link
			to="/$slug"
			params={{ slug: projectData.slug }}
			viewTransition
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
				<CardHeader className="relative gap-4">
					<CardTitle className="flex min-w-0 items-start gap-2">
						<ProjectLogo
							src={projectData.logo}
							name={projectData.name}
							className="size-7"
						/>
						<h2 className="min-w-0 text-xl font-semibold wrap-anywhere">
							{projectData.name}
						</h2>
					</CardTitle>
				</CardHeader>

				<CardContent className="flex-1">
					<div className="relative size-full">
						<div className="flex flex-col gap-4 transition-all duration-300 group-hover:pointer-events-none group-hover:opacity-0">
							<CardDescription className="min-h-10 wrap-anywhere">
								{projectData.tagline}
							</CardDescription>
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

						<div className="absolute inset-0 flex flex-col justify-between opacity-0 transition-opacity duration-300 group-hover:opacity-100">
							<p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
								{projectData.description}
							</p>

							<div className="mt-auto flex items-center justify-between pt-3 text-xs font-medium text-primary">
								<span>View project details</span>
								<IconArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		</Link>
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
						<ProjectCard key={project.slug} {...project} />
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
