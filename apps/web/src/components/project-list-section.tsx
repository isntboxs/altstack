import {
	IconArrowRight,
	IconGitCommit,
	IconGitFork,
	IconStar,
} from '@tabler/icons-react'
import type { LinkComponent } from '@tanstack/react-router'
import { Link, createLink } from '@tanstack/react-router'
import type { FC } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

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

import { useProjectSearch } from '#/features/project/queries'
import type { SearchProjectsParams } from '#/features/project/queries'

type ProjectCardProps =
	ORPCRouterOutputs['project']['search']['projects'][number]

const CreatedPaginationPrevious = createLink(PaginationPrevious)

const CreatedPaginationNext = createLink(PaginationNext)

const CreatedPaginationLink = createLink(PaginationLink)

const CustomPaginationPrevious: LinkComponent<typeof PaginationPrevious> = (
	props
) => <CreatedPaginationPrevious preload="intent" {...props} />

const CustomPaginationNext: LinkComponent<typeof PaginationNext> = (props) => (
	<CreatedPaginationNext preload="intent" {...props} />
)

const CustomPaginationLink: LinkComponent<typeof PaginationLink> = (props) => (
	<CreatedPaginationLink preload="intent" {...props} />
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
		{
			icon: IconGitCommit,
			label: 'Last commit',
			value: 'Unknown',
		},
	]

	return (
		<Link
			to="/$slug"
			params={{ slug: projectData.slug }}
			viewTransition
			className="group relative rounded-xl p-0.5 ring-1 ring-border transition-all duration-300 ease-in-out hover:ring-primary/50"
		>
			<Card className="relative size-full overflow-hidden ring-0">
				{/* Watermark Logo di Pojok Kanan Atas */}
				<div className="pointer-events-none absolute inset-px z-0 overflow-clip rounded-sm opacity-10 blur-[1px] transition-all duration-500 select-none group-hover:scale-110 group-hover:opacity-20 group-hover:blur-none">
					<img
						src={projectData.logo}
						alt={projectData.name}
						aria-hidden="true"
						width={60}
						height={60}
						className="absolute -top-20 -right-20 -z-10 size-60 rotate-12 rounded-md mask-b-from-25 mask-l-from-25 p-[0.09375em] mix-blend-multiply dark:mix-blend-normal"
					/>
				</div>

				<CardHeader className="gap-4">
					<CardTitle className="flex items-center gap-2">
						<img
							src={projectData.logo}
							alt={projectData.name}
							className="size-7 rounded-sm"
						/>

						<h1 className="text-xl font-semibold">{projectData.name}</h1>
					</CardTitle>
				</CardHeader>

				<CardContent className="flex-1">
					<div className="relative size-full">
						{/* Default State: Tagline & GitHub Stats */}
						<div className="flex h-full flex-col justify-between transition-opacity duration-300 group-hover:pointer-events-none group-hover:opacity-0">
							<CardDescription className="line-clamp-2 min-h-10">
								{projectData.tagline}
							</CardDescription>

							<div className="mt-auto grid grid-cols-1 gap-2 pt-3">
								{githubStatsItem.map((item, idx) => (
									<div
										key={idx}
										className="flex items-center justify-between gap-2"
									>
										<div className="flex shrink-0 items-center gap-1.5">
											<item.icon className="size-4 shrink-0 text-muted-foreground" />
											<span className="text-xs whitespace-nowrap text-muted-foreground">
												{item.label}
											</span>
										</div>

										<Separator className="min-w-2 flex-1" />

										<span
											className="max-w-[50%] min-w-0 truncate text-right text-xs font-medium"
											title={String(item.value)}
										>
											{item.value}
										</span>
									</div>
								))}
							</div>
						</div>

						{/* Hover State: Full Description & Details Action */}
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
	page = 1,
	category,
	q,
	sort,
}: SearchProjectsParams) => {
	const { data } = useProjectSearch({ page, category, q, sort })
	const { pagination } = data
	const currentPage = pagination.page || page || 1
	const totalPages = pagination.totalPages
	const hasActiveFilters =
		Boolean(q) || Boolean(category) || (sort !== undefined && sort !== 'newest')

	if (data.projects.length === 0) {
		return (
			<section className="container mx-auto mb-10 w-full max-w-6xl px-4 lg:px-16">
				<div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
					<p className="text-lg font-medium">No projects found</p>
					<p className="mt-1 text-sm text-muted-foreground">
						{hasActiveFilters
							? 'No projects match your current filters. Try a different search term or clear filters above.'
							: 'There are no published projects available in the catalogue yet.'}
					</p>
				</div>
			</section>
		)
	}

	if (totalPages <= 1) {
		return (
			<section className="container mx-auto mb-10 w-full max-w-6xl px-4 lg:px-16">
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{data.projects.map((project) => (
						<ProjectCard key={project.slug} {...project} />
					))}
				</div>
			</section>
		)
	}

	const paginationItems = getPaginationItems(currentPage, totalPages)

	return (
		<section className="container mx-auto mb-10 w-full max-w-6xl px-4 lg:px-16">
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{data.projects.map((project) => (
					<ProjectCard key={project.slug} {...project} />
				))}
			</div>

			<Pagination className="mt-8">
				<PaginationContent>
					{/* Previous Button */}
					<PaginationItem>
						<CustomPaginationPrevious
							from="/"
							search={(prev) => {
								return {
									...prev,
									page: currentPage - 1 === 1 ? undefined : currentPage - 1,
								}
							}}
							resetScroll={false}
							disabled={!pagination.hasPreviousPage}
							viewTransition
						/>
					</PaginationItem>

					{/* Page Numbers & Ellipsis */}
					{paginationItems.map((item, idx) => (
						<PaginationItem key={idx}>
							{item === 'ellipsis' ? (
								<PaginationEllipsis />
							) : (
								<CustomPaginationLink
									from="/"
									search={(prev) => {
										return {
											...prev,
											page: item === 1 ? undefined : item,
										}
									}}
									resetScroll={false}
									isActive={item === currentPage}
									viewTransition
								>
									{item}
								</CustomPaginationLink>
							)}
						</PaginationItem>
					))}

					{/* Next Button */}
					<PaginationItem>
						<CustomPaginationNext
							disabled={!pagination.hasNextPage}
							from="/"
							search={(prev) => {
								return {
									...prev,
									page: currentPage + 1,
								}
							}}
							resetScroll={false}
							viewTransition
						/>
					</PaginationItem>
				</PaginationContent>
			</Pagination>
		</section>
	)
}
