import {
	IconArrowRight,
	IconCheck,
	IconFlag,
	IconFolders,
	IconHistory,
	IconInbox,
	IconLayoutGrid,
	IconPlus,
	IconSettings,
	IconTags,
	IconUserCheck,
} from '@tabler/icons-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, linkOptions } from '@tanstack/react-router'
import { useState } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@altstack/ui/components/alert'
import { Badge } from '@altstack/ui/components/badge'
import { buttonVariants } from '@altstack/ui/components/button'
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@altstack/ui/components/empty'
import { Skeleton } from '@altstack/ui/components/skeleton'
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@altstack/ui/components/tabs'

import { QueryBoundary } from '#/components/query-boundary'
import {
	AdminError,
	AdminPageHeader,
	AdminTime,
	RefreshButton,
} from '#/features/admin-dashboard/components/dashboard-state'
import { ProjectStatusChart } from '#/features/admin-dashboard/components/project-status-chart'
import { dashboardQueries } from '#/features/admin-dashboard/queries'

type Overview = ORPCRouterOutputs['admin']['dashboard']['overview']
const number = new Intl.NumberFormat('en-US')
const compactNumber = new Intl.NumberFormat('en-US', {
	notation: 'compact',
	maximumFractionDigits: 1,
})
const queues = [
	{
		key: 'all',
		label: 'All',
		emptyTitle: 'All queues are clear',
		emptyDescription:
			'No submissions, open reports, or ownership requests are awaiting your review.',
	},
	{
		key: 'submissions',
		label: 'Submissions',
		emptyTitle: 'No submissions to review',
		emptyDescription:
			'New community submissions will appear here when they are ready for review.',
	},
	{
		key: 'reports',
		label: 'Reports',
		emptyTitle: 'No open reports',
		emptyDescription:
			'Reported issues and corrections will appear here when readers flag a project.',
	},
	{
		key: 'claims',
		label: 'Ownership',
		emptyTitle: 'No pending ownership requests',
		emptyDescription:
			'Email-confirmed ownership requests you can review will appear here.',
	},
] as const

function reviewItems(data: Overview) {
	return [
		...data.submissions.map((item) => {
			return {
				id: item.id,
				kind: 'submissions',
				label: 'Submission',
				title: item.name,
				detail: `Submitted by ${item.submitter?.name ?? 'unavailable submitter'}`,
				date: item.createdAt,
				icon: IconInbox,
				reviewLabel: `Review ${item.name}`,
				link: linkOptions({
					to: '/projects/$id/edit',
					params: { id: item.id },
				}),
			}
		}),
		...data.reports.map((item) => {
			return {
				id: item.id,
				kind: 'reports',
				label: 'Report',
				title: item.project?.name ?? 'Deleted project',
				detail: item.type.replaceAll('_', ' '),
				date: item.createdAt,
				icon: IconFlag,
				reviewLabel: `Review report for ${item.project?.name ?? 'deleted project'}`,
				link: linkOptions({
					to: '/admin/reports',
					search: { status: 'open', reportId: item.id },
				}),
			}
		}),
		...data.claims.map((item) => {
			return {
				id: item.id,
				kind: 'claims',
				label: 'Ownership',
				title: item.projectName,
				detail: `${item.name} · ${item.role} request`,
				date: item.requestedAt,
				icon: IconUserCheck,
				reviewLabel: `Review ${item.name}'s claim`,
				link: linkOptions({
					to: '/admin/ownership',
					search: { claimId: item.id },
				}),
			}
		}),
	].toSorted((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

export function AdminOverview(props: { userId: string }) {
	return (
		<QueryBoundary
			resetKey={props.userId}
			pending={<OverviewPending />}
			error={(_, retry) => <AdminError retry={retry} />}
		>
			<OverviewContent {...props} />
		</QueryBoundary>
	)
}

function OverviewContent({ userId }: { userId: string }) {
	const query = useSuspenseQuery(dashboardQueries.overview(userId))
	const data = query.data
	return (
		<div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
			<AdminPageHeader
				title="Admin overview"
				description="Review incoming work and keep the AltStack catalog up to date."
			>
				<RefreshButton
					fetching={query.isFetching}
					refresh={() => void query.refetch()}
				/>
				<Link to="/projects/create" className={buttonVariants()}>
					<IconPlus data-icon="inline-start" />
					Create project
				</Link>
			</AdminPageHeader>
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-muted-foreground">
				<p>
					Last updated <AdminTime value={data.observedAt} relative />
				</p>
				<p>Automatically refreshes every minute</p>
			</div>
			{query.isError && (
				<Alert variant="destructive">
					<AlertTitle>Unable to refresh overview</AlertTitle>
					<AlertDescription>
						The last loaded data is still shown below. Use Refresh to try again.
					</AlertDescription>
				</Alert>
			)}
			<div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
				<ReviewQueue data={data} />
				<aside
					aria-label="Catalog summary and tools"
					className="grid min-w-0 items-start gap-6 md:grid-cols-2 xl:grid-cols-1"
				>
					<ProjectStatusChart statuses={data.statuses} counts={data.counts} />
					<CatalogTools />
				</aside>
			</div>
		</div>
	)
}

function ReviewQueue({ data }: { data: Overview }) {
	const [active, setActive] = useState('all')
	const counts = {
		all:
			data.counts.needsReview +
			data.counts.openReports +
			data.counts.pendingClaims,
		submissions: data.counts.needsReview,
		reports: data.counts.openReports,
		claims: data.counts.pendingClaims,
	}
	const items = reviewItems(data)
	const destinations = linkOptions([
		{
			label: 'Submissions to review',
			count: data.counts.needsReview,
			to: '/admin/submissions',
		},
		{
			label: 'Open reports',
			count: data.counts.openReports,
			to: '/admin/reports',
			search: { status: 'open' },
		},
		{
			label: 'Pending ownership',
			count: data.counts.pendingClaims,
			to: '/admin/ownership',
		},
	])
	return (
		<section aria-labelledby="overview-review-title" className="min-w-0">
			<Card>
				<CardHeader className="border-b">
					<CardTitle>
						<h2 id="overview-review-title">Needs your attention</h2>
					</CardTitle>
					<CardDescription>
						Review submissions, reports, and ownership requests.
					</CardDescription>
					<CardAction>
						<Badge variant={counts.all > 0 ? 'default' : 'secondary'}>
							{number.format(counts.all)} pending
						</Badge>
					</CardAction>
				</CardHeader>
				<CardContent className="min-w-0">
					<Tabs
						value={active}
						onValueChange={(value) => {
							if (typeof value === 'string') setActive(value)
						}}
						className="min-w-0 gap-4"
					>
						<div className="min-w-0 pb-1">
							<TabsList
								activateOnFocus
								aria-label="Filter review queues"
								variant="line"
								className="grid w-full grid-cols-2 gap-2 group-data-horizontal/tabs:h-auto sm:flex sm:w-fit sm:group-data-horizontal/tabs:h-8"
							>
								{queues.map((queue) => (
									<TabsTrigger
										key={queue.key}
										value={queue.key}
										aria-label={`${queue.label} ${number.format(counts[queue.key])}`}
										className="h-9 min-w-0 px-1.5 text-xs sm:h-full sm:text-sm"
									>
										{queue.label}
										<Badge variant="secondary">
											{compactNumber.format(counts[queue.key])}
										</Badge>
									</TabsTrigger>
								))}
							</TabsList>
						</div>
						{queues.map((queue) => {
							const visible = items.filter(
								(item) => queue.key === 'all' || item.kind === queue.key
							)
							return (
								<TabsContent
									key={queue.key}
									value={queue.key}
									className="min-w-0"
								>
									{visible.length > 0 ? (
										<ul
											aria-label={`${queue.label} review items`}
											className="max-h-136 scroll-py-2 divide-y overflow-y-auto overscroll-contain rounded-lg border"
										>
											{visible.map((item) => (
												<li key={`${item.kind}:${item.id}`}>
													<Link
														{...item.link}
														aria-label={item.reviewLabel}
														className="group flex min-w-0 items-start gap-3 p-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
													>
														<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
															<item.icon
																className="size-4"
																aria-hidden="true"
															/>
														</span>
														<div className="flex min-w-0 flex-1 flex-col gap-1.5">
															<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
																<span className="text-sm font-medium wrap-anywhere group-hover:underline">
																	{item.title}
																</span>
																<Badge variant="outline">{item.label}</Badge>
															</div>
															<p className="text-xs wrap-anywhere text-muted-foreground">
																{item.detail}
															</p>
															<p className="text-xs text-muted-foreground">
																<AdminTime value={item.date} relative />
															</p>
														</div>
														<IconArrowRight
															className="mt-2 size-4 shrink-0 text-muted-foreground"
															aria-hidden="true"
														/>
													</Link>
												</li>
											))}
										</ul>
									) : (
										<Empty className="min-h-64 border bg-muted/20">
											<EmptyHeader>
												<EmptyMedia variant="icon">
													<IconCheck />
												</EmptyMedia>
												<EmptyTitle>{queue.emptyTitle}</EmptyTitle>
												<EmptyDescription>
													{queue.emptyDescription}
												</EmptyDescription>
											</EmptyHeader>
										</Empty>
									)}
									<p className="pt-3 text-xs text-muted-foreground">
										{counts[queue.key] === 0
											? 'This queue has no pending work.'
											: `Showing ${number.format(visible.length)} of ${number.format(counts[queue.key])} pending items. Up to five oldest items per queue.`}
									</p>
								</TabsContent>
							)
						})}
					</Tabs>
				</CardContent>
				<CardFooter className="flex-col items-stretch gap-2">
					<p className="text-xs text-muted-foreground">
						Open a full queue to review every item
					</p>
					<nav
						aria-label="Full review queues"
						className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
					>
						{destinations.map(({ label, count, ...link }) => (
							<Link
								key={label}
								{...link}
								aria-label={`${label}: ${number.format(count)}`}
								className={buttonVariants({ variant: 'outline', size: 'sm' })}
							>
								{label}
								<Badge variant="secondary">{number.format(count)}</Badge>
							</Link>
						))}
					</nav>
				</CardFooter>
			</Card>
		</section>
	)
}

function CatalogTools() {
	const tools = linkOptions([
		{
			label: 'Create category',
			description: 'Organize the catalog',
			icon: IconTags,
			to: '/admin/categories/create',
		},
		{
			label: 'Manage collections',
			description: 'Build curated discovery pages',
			icon: IconFolders,
			to: '/admin/collections',
		},
		{
			label: 'Curate featured projects',
			description: 'Choose sidebar recommendations',
			icon: IconLayoutGrid,
			to: '/admin/featured',
		},
		{
			label: 'Browse audit activity',
			description: 'See recorded admin changes',
			icon: IconHistory,
			to: '/admin/activity',
		},
		{
			label: 'Check operations',
			description: 'Review sync and notification status',
			icon: IconSettings,
			to: '/admin/operations',
		},
	])
	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>
					<h2>Catalog tools</h2>
				</CardTitle>
				<CardDescription>
					Shortcuts for keeping the catalog organized.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<nav
					aria-label="Catalog tools"
					className="flex flex-col divide-y rounded-lg border"
				>
					{tools.map(({ label, description, icon: Icon, ...link }) => (
						<Link
							key={label}
							{...link}
							aria-label={label}
							className="group flex min-w-0 items-center gap-3 p-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
						>
							<Icon
								className="size-4 shrink-0 text-muted-foreground"
								aria-hidden="true"
							/>
							<div className="flex min-w-0 flex-1 flex-col gap-1">
								<span className="text-sm font-medium wrap-anywhere group-hover:underline">
									{label}
								</span>
								<span className="text-xs wrap-anywhere text-muted-foreground">
									{description}
								</span>
							</div>
							<IconArrowRight
								className="size-4 shrink-0 text-muted-foreground"
								aria-hidden="true"
							/>
						</Link>
					))}
				</nav>
			</CardContent>
		</Card>
	)
}

function OverviewPending() {
	return (
		<div className="flex flex-col gap-6">
			<output className="sr-only">Loading admin overview</output>
			<Skeleton className="h-4 w-64 max-w-full" />
			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
				<Skeleton className="h-120 w-full rounded-xl" />
				<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
					<Skeleton className="h-96 w-full rounded-xl" />
					<Skeleton className="h-80 w-full rounded-xl" />
				</div>
			</div>
		</div>
	)
}
