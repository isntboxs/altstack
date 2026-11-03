import {
	IconArrowRight,
	IconGitCommit,
	IconLicense,
	IconStar,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import type { LinkComponent } from '@tanstack/react-router'
import { Link, createLink, useRouter } from '@tanstack/react-router'
import type { FC, ReactNode } from 'react'
import { useState } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import type { ProjectCardPreview } from '@altstack/shared/schemas/project'

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
import { AdListingGrid } from '#/features/ads/components'
import { useCatalogueOffset } from '#/features/ads/use-catalogue-offset'
import { LicenseLabel } from '#/features/project/components/license-label'
import { githubElapsed, githubFullDate } from '#/features/project/github-time'
import type { ProjectPageLinkOptions } from '#/features/project/page-links'
import { projectCatalogueKey, projectQueries } from '#/features/project/queries'
import { createPaginationScrollHandler } from '#/lib/pagination-scroll'

type ProjectCardProps = ProjectCardPreview & {
	now?: number
	headingLevel?: 'h2' | 'h3'
}

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
		return [1, 2, 3, 4, 'ellipsis-end' as const, totalPages]
	}

	if (currentPage >= totalPages - 2) {
		return [
			1,
			'ellipsis-start' as const,
			totalPages - 3,
			totalPages - 2,
			totalPages - 1,
			totalPages,
		]
	}

	return [
		1,
		'ellipsis-start' as const,
		currentPage - 1,
		currentPage,
		currentPage + 1,
		'ellipsis-end' as const,
		totalPages,
	]
}

const numberFormatter = new Intl.NumberFormat('en-US', { notation: 'standard' })

export const ProjectCard: FC<ProjectCardProps> = (projectData) => {
	const Heading = projectData.headingLevel ?? 'h2'
	const githubStatsItem = [
		{
			icon: IconStar,
			label: 'Stars',
			value: numberFormatter.format(projectData.github.stars),
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
			className="group/project-card relative min-w-0 rounded-xl p-0.5 ring-1 ring-border transition-colors hover:ring-primary/50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
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
						<Heading className="min-w-0 text-xl font-semibold wrap-anywhere">
							<Link
								to="/$slug"
								params={{ slug: projectData.slug }}
								viewTransition
								className="after:absolute after:inset-0 after:z-10 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
							>
								{projectData.name} {projectData.verified && <VerifiedBadge />}
							</Link>
						</Heading>
						{projectData.github.archived === true && (
							<Badge variant="secondary" className="shrink-0">
								Archived
							</Badge>
						)}
					</CardTitle>
				</CardHeader>

				<CardContent className="flex flex-1 flex-col">
					<div className="relative flex min-h-38 flex-1 flex-col">
						<div
							data-slot="project-card-summary"
							className="flex flex-1 flex-col gap-4 group-focus-within/project-card:invisible group-hover/project-card:invisible pointer-coarse:pb-8"
						>
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
						</div>
						<section
							data-slot="project-card-description"
							aria-label={`${projectData.name} description`}
							// oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll long descriptions without opening the project.
							tabIndex={0}
							className="invisible absolute inset-x-0 top-0 bottom-8 z-20 overflow-y-auto overscroll-contain rounded-sm wrap-anywhere whitespace-pre-line group-focus-within/project-card:visible group-hover/project-card:visible focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
						>
							<CardDescription className="h-full">
								<Link
									to="/$slug"
									params={{ slug: projectData.slug }}
									viewTransition
									tabIndex={-1}
									className="block min-h-full"
								>
									{projectData.description.trim() || projectData.tagline}
								</Link>
							</CardDescription>
						</section>
						<Link
							to="/$slug"
							params={{ slug: projectData.slug }}
							viewTransition
							className="invisible absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 rounded-sm text-xs font-medium text-primary group-focus-within/project-card:visible group-hover/project-card:visible hover:underline focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:visible"
						>
							<span>View project details</span>
							<IconArrowRight aria-hidden="true" className="size-4" />
						</Link>
					</div>
				</CardContent>
			</Card>
		</article>
	)
}

/** Keeps pagination scoped to its catalogue and offers recovery for out-of-range pages. */
export const ProjectListSection = ({
	data: loaded,
	emptyMessage,
	emptyAction,
	pageLinkOptions,
	scrollTargetId = 'project-filters',
}: {
	data: ORPCRouterOutputs['project']['search']
	emptyMessage: string
	emptyAction?: ReactNode
	pageLinkOptions: (page: number) => ProjectPageLinkOptions
	scrollTargetId?: string
}) => {
	const router = useRouter()
	const expectedOffset = useCatalogueOffset(
		projectCatalogueKey(loaded.query ?? {}),
		loaded.query?.page ?? 1
	)
	const query = useQuery({
		...projectQueries.search(loaded.query ?? {}, expectedOffset),
		enabled: Boolean(loaded.query),
	})
	const data = query.data ?? loaded
	const [consumed, setConsumed] = useState(45)
	const { pagination, currentPage, offset, totalPages, outOfRange } =
		getCataloguePagination(data, consumed)
	const handlePageClick = createPaginationScrollHandler(scrollTargetId, router)
	if (loaded.query && !query.data && loaded.query.offset !== expectedOffset) {
		if (query.isError) {
			return (
				<div role="alert" className="container mx-auto p-4">
					Unable to restore this catalogue page.{' '}
					<Button onClick={() => void query.refetch()}>Retry projects</Button>
				</div>
			)
		}
		return (
			<output className="container mx-auto block p-4">Loading projects…</output>
		)
	}

	return (
		<section
			aria-label="Project results"
			className="container mx-auto mb-10 w-full max-w-6xl space-y-4 px-4 lg:px-16"
		>
			{data.projects.length === 0 ? (
				<ProjectResultsEmpty
					outOfRange={outOfRange}
					emptyMessage={emptyMessage}
					emptyAction={emptyAction}
					pageLinkOptions={pageLinkOptions}
					onPageClick={handlePageClick}
				/>
			) : (
				<AdListingGrid
					onConsumed={setConsumed}
					items={data.projects}
					catalogue={projectCatalogueKey(data.query ?? {})}
					page={currentPage}
					offset={offset}
					renderItem={(project) => (
						<ProjectCard
							key={project.slug}
							{...project}
							now={data.asOf?.getTime()}
						/>
					)}
				/>
			)}
			{totalPages > 1 && !outOfRange && (
				<ProjectPagination
					currentPage={currentPage}
					totalPages={totalPages}
					hasPreviousPage={pagination.hasPreviousPage}
					pageLinkOptions={pageLinkOptions}
					onPageClick={handlePageClick}
				/>
			)}
		</section>
	)
}

type CatalogueNavigation = {
	pageLinkOptions: (page: number) => ProjectPageLinkOptions
	onPageClick: ReturnType<typeof createPaginationScrollHandler>
}

function ProjectPagination({
	currentPage,
	totalPages,
	hasPreviousPage,
	pageLinkOptions,
	onPageClick,
}: CatalogueNavigation & {
	currentPage: number
	totalPages: number
	hasPreviousPage: boolean
}) {
	const paginationItems = getPaginationItems(currentPage, totalPages)
	return (
		<Pagination className="mt-8">
			<PaginationContent className="flex-wrap justify-center">
				<PaginationItem>
					{hasPreviousPage ? (
						<CustomPaginationPrevious
							{...pageLinkOptions(currentPage - 1)}
							resetScroll={false}
							onClick={onPageClick}
							viewTransition
						/>
					) : (
						<Button disabled variant="ghost" aria-label="Go to previous page">
							Previous
						</Button>
					)}
				</PaginationItem>
				{paginationItems.map((item) => (
					<PaginationItem key={item}>
						{typeof item === 'string' ? (
							<PaginationEllipsis />
						) : (
							<CustomPaginationLink
								{...pageLinkOptions(item)}
								resetScroll={false}
								onClick={onPageClick}
								isActive={item === currentPage}
								viewTransition
							>
								{item}
							</CustomPaginationLink>
						)}
					</PaginationItem>
				))}
				<PaginationItem>
					{currentPage < totalPages ? (
						<CustomPaginationNext
							{...pageLinkOptions(currentPage + 1)}
							resetScroll={false}
							onClick={onPageClick}
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
	)
}

function ProjectResultsEmpty({
	outOfRange,
	emptyMessage,
	emptyAction,
	pageLinkOptions,
	onPageClick,
}: CatalogueNavigation & {
	outOfRange: boolean
	emptyMessage: string
	emptyAction?: ReactNode
}) {
	return (
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
					onClick={onPageClick}
					className="inline-flex items-center underline underline-offset-4"
				>
					First page
				</Link>
			) : (
				emptyAction
			)}
		</div>
	)
}

function getCataloguePagination(
	data: ORPCRouterOutputs['project']['search'],
	consumed: number
) {
	const { pagination } = data
	const currentPage = pagination.page || 1
	const offset = data.query?.offset ?? (currentPage - 1) * 45
	const totalPages = Math.max(
		currentPage,
		currentPage +
			Math.ceil(
				(pagination.totalItems -
					offset -
					Math.min(consumed, data.projects.length)) /
					45
			)
	)
	const outOfRange =
		data.projects.length === 0 &&
		currentPage > 1 &&
		offset >= pagination.totalItems
	return { pagination, currentPage, offset, totalPages, outOfRange }
}
