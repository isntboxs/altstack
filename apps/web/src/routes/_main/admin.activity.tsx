import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'

import { AUDIT_ACTIONS } from '@altstack/shared/constants'

import { Badge } from '@altstack/ui/components/badge'
import { Button, buttonVariants } from '@altstack/ui/components/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@altstack/ui/components/dialog'
import { Field, FieldGroup, FieldLabel } from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@altstack/ui/components/select'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@altstack/ui/components/table'

import {
	AdminEmpty,
	AdminError,
	AdminPageHeader,
	AdminPending,
	AdminTime,
	RefreshButton,
} from '#/features/admin-dashboard/components/dashboard-state'
import { dashboardQueries } from '#/features/admin-dashboard/queries'
import { adminActivitySearchSchema } from '#/features/admin-dashboard/search'

export const Route = createFileRoute('/_main/admin/activity')({
	validateSearch: adminActivitySearchSchema,
	component: Activity,
})
const actionItems = [
	{ value: 'all', label: 'All actions' },
	...AUDIT_ACTIONS.map((action) => {
		return {
			value: action,
			label: action.replaceAll('_', ' '),
		}
	}),
]

function Activity() {
	const { auth } = Route.useRouteContext()
	const search = Route.useSearch()
	const navigate = Route.useNavigate()
	const query = useQuery(dashboardQueries.activity(auth.user.id, search))
	const filtersKey = [
		search.actorId,
		search.projectId,
		search.from,
		search.to,
	].join(':')
	return (
		<div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-8">
			<AdminPageHeader
				title="Activity"
				description="Recorded project, ownership, membership, and account audit events. Dates are filtered in UTC."
			>
				<RefreshButton
					fetching={query.isFetching}
					refresh={() => void query.refetch()}
				/>
			</AdminPageHeader>
			<Card>
				<CardHeader>
					<CardTitle>Filter activity</CardTitle>
					<CardDescription>
						Only actions recorded in the audit log appear here. Report decisions
						and taxonomy changes do not currently record audit events.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<Select
						items={actionItems}
						value={search.action ?? 'all'}
						onValueChange={(value) =>
							void navigate({
								search: {
									...search,
									page: 1,
									action: AUDIT_ACTIONS.find((item) => item === value),
								},
							})
						}
					>
						<SelectTrigger
							aria-label="Filter audit action"
							className="w-full sm:w-72"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								{actionItems.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
					<form
						key={filtersKey}
						onSubmit={(event) => {
							event.preventDefault()
							const form = new FormData(event.currentTarget)
							void navigate({
								search: adminActivitySearchSchema.parse({
									...search,
									page: 1,
									actorId: form.get('actorId') ?? undefined,
									projectId: form.get('projectId') ?? undefined,
									from: form.get('from') ?? undefined,
									to: form.get('to') ?? undefined,
								}),
							})
						}}
					>
						<FieldGroup className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
							<Field>
								<FieldLabel htmlFor="audit-actor">Actor ID</FieldLabel>
								<Input
									id="audit-actor"
									name="actorId"
									defaultValue={search.actorId}
									placeholder="Any actor"
									pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="audit-project">Project ID</FieldLabel>
								<Input
									id="audit-project"
									name="projectId"
									defaultValue={search.projectId}
									placeholder="Any project"
									pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="audit-from">From (UTC)</FieldLabel>
								<Input
									id="audit-from"
									name="from"
									type="date"
									defaultValue={search.from}
								/>
							</Field>
							<Field>
								<FieldLabel htmlFor="audit-to">To (UTC)</FieldLabel>
								<Input
									id="audit-to"
									name="to"
									type="date"
									defaultValue={search.to}
									min={search.from}
								/>
							</Field>
							<Field
								orientation="horizontal"
								className="flex-wrap justify-end sm:col-span-2 xl:col-span-4"
							>
								<Button type="submit">Apply</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => void navigate({ search: { page: 1 } })}
								>
									Clear
								</Button>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
			{query.isPending ? (
				<AdminPending />
			) : query.isError ? (
				<AdminError retry={() => void query.refetch()} />
			) : (
				<>
					{query.data.events.length === 0 ? (
						<AdminEmpty
							title="No recorded events"
							description="Try clearing filters or selecting an earlier page."
						/>
					) : (
						<div className="overflow-hidden rounded-xl border">
							<Table aria-label="Recorded audit activity">
								<TableHeader>
									<TableRow>
										<TableHead>Action</TableHead>
										<TableHead>Actor</TableHead>
										<TableHead>Target</TableHead>
										<TableHead>Time</TableHead>
										<TableHead>Details</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{query.data.events.map((event) => (
										<TableRow key={event.id}>
											<TableCell>
												<Badge variant="outline">
													{event.action.replaceAll('_', ' ')}
												</Badge>
											</TableCell>
											<TableCell>
												{event.actor ? (
													<Button
														variant="link"
														size="sm"
														onClick={() =>
															void navigate({
																search: {
																	...search,
																	page: 1,
																	actorId: event.actor?.id,
																},
															})
														}
													>
														{event.actor.name}
													</Button>
												) : (
													'Unavailable actor'
												)}
											</TableCell>
											<TableCell>
												{event.project ? (
													<Link
														to="/projects/$id/edit"
														params={{ id: event.project.id }}
														className="underline underline-offset-4"
													>
														{event.project.name}
													</Link>
												) : event.targetUser ? (
													<Link
														to="/admin/users/$id"
														params={{ id: event.targetUser.id }}
														className="underline underline-offset-4"
													>
														{event.targetUser.name}
													</Link>
												) : (
													'Unavailable target'
												)}
											</TableCell>
											<TableCell>
												<AdminTime value={event.createdAt} />
											</TableCell>
											<TableCell>
												<Dialog>
													<DialogTrigger
														render={<Button variant="outline" size="sm" />}
													>
														Details
													</DialogTrigger>
													<DialogContent>
														<DialogHeader>
															<DialogTitle>
																{event.action.replaceAll('_', ' ')}
															</DialogTitle>
															<DialogDescription>
																Recorded <AdminTime value={event.createdAt} />
															</DialogDescription>
														</DialogHeader>
														<dl className="flex flex-col gap-3 text-sm">
															<div>
																<dt className="text-muted-foreground">
																	Event ID
																</dt>
																<dd className="font-mono text-xs break-all">
																	{event.id}
																</dd>
															</div>
															<div>
																<dt className="text-muted-foreground">Actor</dt>
																<dd>
																	{event.actor?.name ?? 'Unavailable actor'}
																</dd>
															</div>
															<div>
																<dt className="text-muted-foreground">
																	Target
																</dt>
																<dd>
																	{event.project?.name ??
																		event.targetUser?.name ??
																		'Unavailable target'}
																</dd>
															</div>
															{event.details.toStatus && (
																<div>
																	<dt className="text-muted-foreground">
																		Status transition
																	</dt>
																	<dd>
																		{event.details.fromStatus ?? 'Unknown'} →{' '}
																		{event.details.toStatus}
																	</dd>
																</div>
															)}
															{event.details.role && (
																<div>
																	<dt className="text-muted-foreground">
																		Role
																	</dt>
																	<dd>
																		{event.details.previousRole
																			? `${event.details.previousRole} → `
																			: ''}
																		{event.details.role}
																	</dd>
																</div>
															)}
														</dl>
														<p className="text-xs text-muted-foreground">
															Private evidence and review reasons are available
															only in the corresponding project or account
															workflow.
														</p>
														{event.project && (
															<Link
																to="/projects/$id/edit"
																params={{ id: event.project.id }}
																className={buttonVariants({
																	variant: 'outline',
																})}
															>
																Open project and review history
															</Link>
														)}
													</DialogContent>
												</Dialog>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
					<nav
						aria-label="Activity pages"
						className="flex flex-wrap items-center justify-end gap-3"
					>
						<p className="mr-auto text-sm text-muted-foreground">
							{query.data.totalItems.toLocaleString()} events · Page{' '}
							{search.page} of {Math.max(1, query.data.totalPages)}
						</p>
						<Button
							variant="outline"
							disabled={search.page <= 1 || query.isFetching}
							onClick={() =>
								void navigate({ search: { ...search, page: search.page - 1 } })
							}
						>
							Previous
						</Button>
						<Button
							variant="outline"
							disabled={
								search.page >= query.data.totalPages || query.isFetching
							}
							onClick={() =>
								void navigate({ search: { ...search, page: search.page + 1 } })
							}
						>
							Next
						</Button>
					</nav>
				</>
			)}
		</div>
	)
}
