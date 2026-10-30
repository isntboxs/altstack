import { IconArrowRight, IconInbox, IconSearch } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@altstack/ui/components/alert'
import { Badge } from '@altstack/ui/components/badge'
import { Button, buttonVariants } from '@altstack/ui/components/button'
import {
	Card,
	CardAction,
	CardContent,
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
import { Field, FieldLabel } from '@altstack/ui/components/field'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from '@altstack/ui/components/input-group'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@altstack/ui/components/select'
import { Skeleton } from '@altstack/ui/components/skeleton'

import { ProjectLogo } from '#/components/project-media'
import {
	AdminPageHeader,
	AdminTime,
	RefreshButton,
} from '#/features/admin-dashboard/components/dashboard-state'
import { adminProjectQueries } from '#/features/admin-projects/queries'
import type { AdminProjectSearch } from '#/features/admin-projects/search'

const orders = [
	{
		value: 'createdAt:asc',
		label: 'Oldest first',
		sort: 'createdAt',
		order: 'asc',
	},
	{
		value: 'createdAt:desc',
		label: 'Newest first',
		sort: 'createdAt',
		order: 'desc',
	},
	{ value: 'name:asc', label: 'Name A–Z', sort: 'name', order: 'asc' },
	{ value: 'name:desc', label: 'Name Z–A', sort: 'name', order: 'desc' },
] as const

export function SubmissionInbox({
	search,
	onSearchChange,
}: {
	search: AdminProjectSearch
	onSearchChange: (search: AdminProjectSearch) => void
}) {
	const page = search.page ?? 1
	const query = useQuery({
		...adminProjectQueries.list({
			page,
			limit: 12,
			name: search.name,
			needsReview: true,
			status: undefined,
			sort: search.sort ?? 'createdAt',
			order: search.order ?? 'asc',
		}),
		retry: false,
	})
	const updateSearch = (next: AdminProjectSearch) =>
		onSearchChange({ ...next, status: undefined })
	return (
		<div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
			<AdminPageHeader
				title="Submissions"
				description="Review projects submitted by the community. Check the content, then publish or reject with feedback."
			>
				<RefreshButton
					fetching={query.isFetching}
					refresh={() => void query.refetch()}
				/>
				<Link to="/projects" className={buttonVariants({ variant: 'outline' })}>
					All projects
				</Link>
			</AdminPageHeader>
			<Card className="min-w-0">
				<CardHeader className="border-b">
					<CardTitle>
						<h2>Awaiting review</h2>
					</CardTitle>
					<CardAction>
						<Badge variant="secondary">
							{query.data
								? `${query.data.pagination.totalItems} ${search.name ? 'matching' : 'pending'}`
								: query.isError
									? 'Unavailable'
									: 'Loading…'}
						</Badge>
					</CardAction>
				</CardHeader>
				<CardContent className="flex min-w-0 flex-col gap-5">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-end">
						<form
							className="min-w-0 flex-1"
							onSubmit={(event) => {
								event.preventDefault()
								const name = new FormData(event.currentTarget).get('name')
								updateSearch({
									...search,
									page: 1,
									name:
										typeof name === 'string' && name.trim()
											? name.trim()
											: undefined,
								})
							}}
						>
							<Field>
								<FieldLabel htmlFor="submission-search">
									Search project names
								</FieldLabel>
								<div className="flex gap-2">
									<InputGroup>
										<InputGroupAddon>
											<IconSearch aria-hidden="true" />
										</InputGroupAddon>
										<InputGroupInput
											key={search.name ?? ''}
											id="submission-search"
											name="name"
											defaultValue={search.name ?? ''}
											maxLength={100}
											placeholder="Find a submission…"
										/>
									</InputGroup>
									<Button type="submit" variant="outline">
										Search
									</Button>
								</div>
							</Field>
						</form>
						<Field className="w-full sm:w-44">
							<FieldLabel htmlFor="submission-order">
								Sort submissions
							</FieldLabel>
							<Select
								items={orders}
								value={`${search.sort ?? 'createdAt'}:${search.order ?? 'asc'}`}
								onValueChange={(value) => {
									const option = orders.find((item) => item.value === value)
									if (option) {
										updateSearch({
											...search,
											page: 1,
											sort: option.sort,
											order: option.order,
										})
									}
								}}
							>
								<SelectTrigger
									id="submission-order"
									aria-label="Sort submissions"
									className="w-full"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{orders.map((item) => (
											<SelectItem key={item.value} value={item.value}>
												{item.label}
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
						</Field>
					</div>
					{search.name && (
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="min-w-0 text-sm wrap-anywhere text-muted-foreground">
								Results for “{search.name}”
							</p>
							<Button
								variant="ghost"
								size="sm"
								onClick={() =>
									updateSearch({ ...search, page: 1, name: undefined })
								}
							>
								Clear search
							</Button>
						</div>
					)}
					{query.isError && (
						<Alert variant="destructive">
							<AlertTitle>Unable to load submissions</AlertTitle>
							<AlertDescription>
								<p>Check your connection and try again.</p>
								<Button
									variant="outline"
									disabled={query.isFetching}
									onClick={() => void query.refetch()}
								>
									Retry loading
								</Button>
							</AlertDescription>
						</Alert>
					)}
					{query.isPending ? (
						<div className="flex flex-col gap-3">
							<output className="sr-only">Loading submissions</output>
							{[0, 1, 2].map((id) => (
								<Skeleton key={id} className="h-32 w-full rounded-lg" />
							))}
						</div>
					) : (
						query.data && (
							<>
								{query.data.projects.length > 0 ? (
									<ul
										aria-label="Community submissions"
										aria-busy={query.isFetching}
										className="divide-y rounded-lg border"
									>
										{query.data.projects.map((project) => (
											<li
												key={project.id}
												className="flex min-w-0 flex-col gap-4 p-4"
											>
												<div className="flex min-w-0 items-start gap-3">
													<ProjectLogo
														src={project.logo}
														name={project.name}
														className="size-10 shrink-0 rounded-lg"
													/>
													<div className="flex min-w-0 flex-1 flex-col gap-1.5">
														<Link
															to="/projects/$id/edit"
															params={{ id: project.id }}
															className="w-fit rounded-sm text-sm font-medium wrap-anywhere underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
														>
															{project.name}
														</Link>
														<Badge variant="outline">Needs review</Badge>
														<p className="line-clamp-2 text-sm wrap-anywhere text-muted-foreground">
															{project.tagline?.trim()
																? project.tagline
																: 'No tagline provided yet.'}
														</p>
													</div>
												</div>
												<div className="flex flex-wrap items-end justify-between gap-3 sm:pl-13">
													<div className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
														<p className="wrap-anywhere">
															Submitted by{' '}
															{project.submitter?.name ??
																'Unavailable submitter'}
														</p>
														{project.submitter?.email && (
															<p className="wrap-anywhere">
																{project.submitter.email}
															</p>
														)}
														<p>
															Submitted{' '}
															<AdminTime value={project.createdAt} relative />
														</p>
													</div>
													<Link
														to="/projects/$id/edit"
														params={{ id: project.id }}
														aria-label={`Review ${project.name}`}
														className={buttonVariants({
															variant: 'outline',
															size: 'sm',
														})}
													>
														Review submission
														<IconArrowRight data-icon="inline-end" />
													</Link>
												</div>
											</li>
										))}
									</ul>
								) : (
									<Empty className="min-h-64 border bg-muted/20">
										<EmptyHeader>
											<EmptyMedia variant="icon">
												<IconInbox />
											</EmptyMedia>
											<EmptyTitle>
												{search.name
													? 'No matching submissions'
													: page > 1
														? 'No submissions on this page'
														: 'No submissions awaiting review'}
											</EmptyTitle>
											<EmptyDescription>
												{search.name
													? 'Try a different project name or clear your search.'
													: page > 1
														? 'Go to the previous page to continue reviewing.'
														: 'New community submissions will appear here when they are ready for review.'}
											</EmptyDescription>
										</EmptyHeader>
										{search.name && (
											<Button
												variant="outline"
												onClick={() =>
													updateSearch({ ...search, page: 1, name: undefined })
												}
											>
												Show all submissions
											</Button>
										)}
									</Empty>
								)}
							</>
						)
					)}
				</CardContent>
				<CardFooter className="flex-wrap justify-between gap-3">
					<p className="text-xs text-muted-foreground">
						Page {page}
						{query.data
							? ` · ${query.data.pagination.totalItems} ${search.name ? 'matching ' : ''}${query.data.pagination.totalItems === 1 ? 'submission' : 'submissions'}`
							: ''}
					</p>
					<nav
						aria-label="Submission pages"
						className="flex items-center gap-2"
					>
						<Button
							variant="outline"
							size="sm"
							disabled={page <= 1 || query.isFetching}
							onClick={() => updateSearch({ ...search, page: page - 1 })}
						>
							Previous
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={
								!query.data?.pagination.hasNextPage ||
								query.isFetching ||
								query.isError
							}
							onClick={() => updateSearch({ ...search, page: page + 1 })}
						>
							Next
						</Button>
					</nav>
				</CardFooter>
			</Card>
		</div>
	)
}
