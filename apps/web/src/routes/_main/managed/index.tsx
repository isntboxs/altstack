import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'

import { Alert, AlertDescription } from '@altstack/ui/components/alert'
import { Button } from '@altstack/ui/components/button'
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@altstack/ui/components/card'
import { Field, FieldLabel, FieldGroup } from '@altstack/ui/components/field'
import { Textarea } from '@altstack/ui/components/textarea'

import { PublicError } from '#/components/public-page-state'
import { VerifiedBadge } from '#/components/verified-badge'
import { ClaimGithubEvidenceView } from '#/features/project/components/claim-github-evidence'
import { ownershipQueries, ownershipKey } from '#/features/project/ownership'
import { seoHead } from '#/features/seo/meta'
import { invalidateCatalog } from '#/utils/invalidate-catalog'
import { client } from '#/utils/orpc'

export const Route = createFileRoute('/_main/managed/')({
	validateSearch: z.object({
		page: z.coerce.number().int().min(1).optional().catch(1),
		claimsPage: z.coerce.number().int().min(1).optional().catch(1),
	}),
	loaderDeps: ({ search }) => {
		return {
			page: search.page,
			claimsPage: search.claimsPage,
		}
	},
	loader: async ({ context, deps }) => {
		await Promise.all([
			context.queryClient.query(
				ownershipQueries.list(context.auth.user.id, deps.page)
			),
			context.queryClient.query(
				ownershipQueries.inbox(context.auth.user.id, deps.claimsPage)
			),
		])
	},
	head: () =>
		seoHead({
			title: 'My projects | AltStack',
			description: 'Manage your verified projects and access requests.',
			noindex: true,
		}),
	errorComponent: () => <PublicError title="Unable to load your projects" />,
	component: ManagedProjects,
})

function ManagedProjects() {
	const { auth } = Route.useRouteContext()
	const { page = 1, claimsPage = 1 } = Route.useSearch()
	const projects = useSuspenseQuery(
		ownershipQueries.list(auth.user.id, page)
	).data
	const inbox = useSuspenseQuery(
		ownershipQueries.inbox(auth.user.id, claimsPage)
	).data
	const queryClient = useQueryClient()
	const [notes, setNotes] = useState<Record<string, string>>({})
	const review = useMutation({
		mutationFn: ({
			id,
			decision,
			manualEvidence,
		}: {
			id: string
			decision: 'approve' | 'reject'
			manualEvidence?: string
		}) =>
			client.ownership.review({
				params: { id },
				body: { decision, ...(manualEvidence ? { manualEvidence } : {}) },
			}),
		retry: false,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ownershipKey })
			await invalidateCatalog(queryClient)
		},
	})
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 md:p-8">
			<header className="flex flex-col gap-2">
				<h1 className="text-2xl font-semibold">My projects</h1>
				<p className="text-sm text-muted-foreground">
					Owner and maintainer have the same access. Changes to your approved
					projects are published immediately.
				</p>
				<Link to="/" className="text-sm underline underline-offset-4">
					Browse projects to request access
				</Link>
			</header>
			<section aria-label="Managed projects" className="flex flex-col gap-3">
				{projects.projects.length === 0 && (
					<p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
						No approved projects here yet. Open a project and choose Verify, or
						Request access for an already verified project.
					</p>
				)}
				{projects.projects.map((item) => (
					<Card key={item.id}>
						<CardContent className="flex flex-wrap items-center justify-between gap-3">
							<div className="flex flex-col gap-1">
								<h2 className="flex items-center gap-2 font-semibold">
									{item.name}
									<VerifiedBadge />
								</h2>
								<p className="text-sm text-muted-foreground">{item.role}</p>
							</div>
							<Button
								render={<Link to="/managed/$id" params={{ id: item.id }} />}
							>
								Manage project
							</Button>
						</CardContent>
					</Card>
				))}
				{projects.pagination.totalPages > 1 && (
					<nav
						aria-label="Managed projects pages"
						className="flex items-center gap-3"
					>
						{page > 1 && (
							<Link
								from={Route.fullPath}
								search={(previous) => {
									return { ...previous, page: page - 1 }
								}}
							>
								Previous
							</Link>
						)}
						<span className="text-sm">
							Page {page} of {projects.pagination.totalPages}
						</span>
						{projects.pagination.hasNextPage && (
							<Link
								from={Route.fullPath}
								search={(previous) => {
									return { ...previous, page: page + 1 }
								}}
							>
								Next
							</Link>
						)}
					</nav>
				)}
			</section>
			<section aria-labelledby="claim-inbox" className="flex flex-col gap-3">
				<h2 id="claim-inbox" className="text-lg font-semibold">
					Access requests
				</h2>
				<p className="text-sm text-muted-foreground">
					Only approve someone you have confirmed represents the project. Email
					confirmation proves inbox access. Admins review the first
					representative; existing representatives review additional requests.
				</p>
				{review.isError && (
					<Alert variant="destructive">
						<AlertDescription>
							{review.error.message}{' '}
							<Button
								variant="link"
								onClick={() =>
									void queryClient.invalidateQueries({
										queryKey: ownershipKey,
									})
								}
							>
								Refresh requests
							</Button>
						</AlertDescription>
					</Alert>
				)}
				{inbox.claims.length === 0 && (
					<p className="text-sm text-muted-foreground">
						No requests awaiting your review.
					</p>
				)}
				{inbox.claims.map((claim) => (
					<Card key={claim.id}>
						<CardHeader>
							<CardTitle>{claim.projectName}</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-wrap items-center justify-between gap-4">
							<div className="min-w-0 text-sm">
								<p className="wrap-anywhere">
									{claim.name} · {claim.email}
								</p>
								<p className="text-muted-foreground">
									Requested {claim.role} access · Email confirmed
								</p>
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									disabled={review.isPending}
									onClick={() =>
										review.mutate({ id: claim.id, decision: 'reject' })
									}
								>
									Decline
								</Button>
								<Button
									disabled={review.isPending}
									onClick={() =>
										review.mutate({
											id: claim.id,
											decision: 'approve',
											manualEvidence: notes[claim.id]?.trim() || undefined,
										})
									}
								>
									Approve
								</Button>
							</div>
							<div className="flex w-full flex-col gap-3">
								<ClaimGithubEvidenceView evidence={claim.githubEvidence} />
								<FieldGroup>
									<Field>
										<FieldLabel htmlFor={`evidence-${claim.id}`}>
											Independent verification notes for {claim.projectName}
										</FieldLabel>
										<Textarea
											id={`evidence-${claim.id}`}
											value={notes[claim.id] ?? ''}
											onChange={(event) =>
												setNotes((previous) => {
													return {
														...previous,
														[claim.id]: event.target.value,
													}
												})
											}
											maxLength={1000}
											disabled={review.isPending}
											placeholder="How did you confirm this person represents the project?"
										/>
										<p className="text-xs text-muted-foreground">
											Required for write access or when GitHub cannot confirm
											access (20–1000 characters). GitHub access is checked
											again on approval.
										</p>
									</Field>
								</FieldGroup>
							</div>
						</CardContent>
					</Card>
				))}
				{inbox.pagination.totalPages > 1 && (
					<nav
						aria-label="Access request pages"
						className="flex items-center gap-3"
					>
						{claimsPage > 1 && (
							<Link
								from={Route.fullPath}
								search={(previous) => {
									return {
										...previous,
										claimsPage: claimsPage - 1,
									}
								}}
							>
								Previous requests
							</Link>
						)}
						<span className="text-sm">
							Page {claimsPage} of {inbox.pagination.totalPages}
						</span>
						{inbox.pagination.hasNextPage && (
							<Link
								from={Route.fullPath}
								search={(previous) => {
									return {
										...previous,
										claimsPage: claimsPage + 1,
									}
								}}
							>
								Next requests
							</Link>
						)}
					</nav>
				)}
			</section>
		</main>
	)
}
