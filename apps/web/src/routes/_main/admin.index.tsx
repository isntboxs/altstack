import {
	IconArrowRight,
	IconPlus,
	IconPackage,
	IconInbox,
	IconFlag,
	IconUserCheck,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, linkOptions } from '@tanstack/react-router'

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
	AdminEmpty,
	AdminError,
	AdminPageHeader,
	AdminPending,
	AdminTime,
	RefreshButton,
} from '#/features/admin-dashboard/components/dashboard-state'
import { ProjectStatusChart } from '#/features/admin-dashboard/components/project-status-chart'
import { dashboardQueries } from '#/features/admin-dashboard/queries'

export const Route = createFileRoute('/_main/admin/')({
	component: AdminOverview,
})

function AdminOverview() {
	const { auth } = Route.useRouteContext()
	const query = useQuery(dashboardQueries.overview(auth.user.id))
	const data = query.data
	const metrics = linkOptions([
		{
			label: 'Published projects',
			key: 'published',
			description: 'Live in the catalog',
			icon: IconPackage,
			to: '/projects',
			search: { status: 'published' },
		},
		{
			label: 'Submissions to review',
			key: 'needsReview',
			description: 'Drafts submitted by the community',
			icon: IconInbox,
			to: '/admin/submissions',
		},
		{
			label: 'Open reports',
			key: 'openReports',
			description: 'Corrections awaiting a decision',
			icon: IconFlag,
			to: '/admin/reports',
			search: { status: 'open' },
		},
		{
			label: 'Pending ownership',
			key: 'pendingClaims',
			description: 'Requests you can review',
			icon: IconUserCheck,
			to: '/admin/ownership',
		},
	])
	return (
		<div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-8">
			<AdminPageHeader
				title="Admin overview"
				description="Your daily workspace for keeping the AltStack catalog useful, trusted, and up to date."
			>
				<RefreshButton
					fetching={query.isFetching}
					refresh={() => void query.refetch()}
				/>
				<Link to="/projects/create" className={buttonVariants({})}>
					<IconPlus data-icon="inline-start" />
					Create project
				</Link>
			</AdminPageHeader>
			{query.isPending ? (
				<AdminPending />
			) : query.isError ? (
				<AdminError retry={() => void query.refetch()} />
			) : (
				data && (
					<>
						<div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
							<Badge variant="outline">Admin workspace</Badge>
							<span>
								Updated <AdminTime value={data.observedAt} relative /> ·
								refreshes every minute
							</span>
						</div>
						<section
							aria-label="Key metrics"
							className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
						>
							{metrics.map(
								({ label, key, description, icon: Icon, ...link }) => (
									<Card
										key={key}
										className="relative transition-shadow hover:ring-1 hover:ring-ring"
									>
										<CardHeader>
											<CardDescription>{label}</CardDescription>
											<CardAction>
												<Icon className="size-5 text-muted-foreground" />
											</CardAction>
											<CardTitle className="text-3xl tabular-nums">
												<Link
													{...link}
													aria-label={`${label}: ${data.counts[key].toLocaleString()}`}
													className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
												>
													<span className="sr-only">{label}: </span>
													{data.counts[key].toLocaleString()}
												</Link>
											</CardTitle>
										</CardHeader>
										<CardFooter className="text-xs text-muted-foreground">
											{description}
											<IconArrowRight className="ml-auto size-4" />
										</CardFooter>
									</Card>
								)
							)}
						</section>
						<div className="grid items-start gap-6 xl:grid-cols-3">
							<Card>
								<CardHeader>
									<CardTitle>Submissions</CardTitle>
									<CardDescription>
										Oldest project records awaiting review
									</CardDescription>
									<CardAction>
										<Badge variant="secondary">{data.counts.needsReview}</Badge>
									</CardAction>
								</CardHeader>
								<CardContent className="flex flex-col gap-4">
									{data.submissions.length === 0 && <AdminEmpty />}
									{data.submissions.map((item) => (
										<div
											key={item.id}
											className="flex items-start justify-between gap-3"
										>
											<div className="min-w-0">
												<Link
													className="font-medium underline-offset-4 hover:underline"
													to="/projects/$id/edit"
													params={{ id: item.id }}
												>
													{item.name}
												</Link>
												<p className="text-xs text-muted-foreground">
													{item.submitter?.name ?? 'Unavailable submitter'} ·{' '}
													<Badge variant="outline">Needs review</Badge>
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													Created <AdminTime value={item.createdAt} relative />
												</p>
											</div>
											<Link
												to="/projects/$id/edit"
												params={{ id: item.id }}
												className={buttonVariants({
													size: 'sm',
													variant: 'outline',
												})}
												aria-label={`Review ${item.name}`}
											>
												Review
											</Link>
										</div>
									))}
								</CardContent>
								<CardFooter>
									<Link
										to="/admin/submissions"
										className={buttonVariants({ variant: 'link' })}
									>
										View submission queue
										<IconArrowRight data-icon="inline-end" />
									</Link>
								</CardFooter>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>Reports</CardTitle>
									<CardDescription>
										Oldest open reports and corrections
									</CardDescription>
									<CardAction>
										<Badge variant="secondary">{data.counts.openReports}</Badge>
									</CardAction>
								</CardHeader>
								<CardContent className="flex flex-col gap-4">
									{data.reports.length === 0 && <AdminEmpty />}
									{data.reports.map((item) => (
										<div
											key={item.id}
											className="flex items-start justify-between gap-3"
										>
											<div className="min-w-0">
												<p className="font-medium">
													{item.project?.name ?? 'Deleted project'}
												</p>
												<p className="text-xs text-muted-foreground">
													{item.type.replaceAll('_', ' ')} · Open
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													Reported <AdminTime value={item.createdAt} relative />
												</p>
											</div>
											<Link
												to="/admin/reports"
												search={{ status: 'open', reportId: item.id }}
												className={buttonVariants({
													size: 'sm',
													variant: 'outline',
												})}
												aria-label={`Review report for ${item.project?.name ?? 'deleted project'}`}
											>
												Review
											</Link>
										</div>
									))}
								</CardContent>
								<CardFooter>
									<Link
										to="/admin/reports"
										search={{ status: 'open' }}
										className={buttonVariants({ variant: 'link' })}
									>
										View report inbox
										<IconArrowRight data-icon="inline-end" />
									</Link>
								</CardFooter>
							</Card>
							<Card>
								<CardHeader>
									<CardTitle>Ownership</CardTitle>
									<CardDescription>
										Email confirmed requests you can review
									</CardDescription>
									<CardAction>
										<Badge variant="secondary">
											{data.counts.pendingClaims}
										</Badge>
									</CardAction>
								</CardHeader>
								<CardContent className="flex flex-col gap-4">
									{data.claims.length === 0 && <AdminEmpty />}
									{data.claims.map((item) => (
										<div
											key={item.id}
											className="flex items-start justify-between gap-3"
										>
											<div className="min-w-0">
												<p className="font-medium">{item.projectName}</p>
												<p className="text-xs text-muted-foreground">
													{item.name} · {item.role} · Pending
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													Requested{' '}
													<AdminTime value={item.requestedAt} relative />
												</p>
											</div>
											<Link
												to="/admin/ownership"
												search={{ claimId: item.id }}
												className={buttonVariants({
													size: 'sm',
													variant: 'outline',
												})}
												aria-label={`Review ${item.name}'s claim`}
											>
												Review
											</Link>
										</div>
									))}
								</CardContent>
								<CardFooter>
									<Link
										to="/admin/ownership"
										className={buttonVariants({ variant: 'link' })}
									>
										View ownership queue
										<IconArrowRight data-icon="inline-end" />
									</Link>
								</CardFooter>
							</Card>
						</div>
						<div className="grid items-start gap-6 lg:grid-cols-2">
							<ProjectStatusChart statuses={data.statuses} />
							<Card>
								<CardHeader>
									<CardTitle>Keep the catalog moving</CardTitle>
									<CardDescription>
										{data.counts.totalProjects.toLocaleString()} projects ·{' '}
										{data.counts.users.toLocaleString()} accounts
									</CardDescription>
								</CardHeader>
								<CardContent className="grid gap-3 sm:grid-cols-2">
									<Link
										to="/admin/categories/create"
										className={buttonVariants({ variant: 'outline' })}
									>
										<IconPlus data-icon="inline-start" />
										Create category
									</Link>
									<Link
										to="/admin/featured"
										className={buttonVariants({ variant: 'outline' })}
									>
										Curate featured projects
									</Link>
									<Link
										to="/admin/activity"
										className={buttonVariants({ variant: 'outline' })}
									>
										Browse audit activity
									</Link>
									<Link
										to="/admin/operations"
										className={buttonVariants({ variant: 'outline' })}
									>
										Check operations
									</Link>
								</CardContent>
								<CardFooter className="text-xs text-muted-foreground">
									Review actions open their existing moderation and verification
									flows.
								</CardFooter>
							</Card>
						</div>
					</>
				)
			)}
		</div>
	)
}
