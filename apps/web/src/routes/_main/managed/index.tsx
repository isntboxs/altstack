import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'

import { buttonVariants } from '@altstack/ui/components/button'
import { Card, CardContent } from '@altstack/ui/components/card'

import { PublicError } from '#/components/public-page-state'
import { VerifiedBadge } from '#/components/verified-badge'
import { ClaimInbox } from '#/features/project/components/claim-inbox'
import { ownershipQueries } from '#/features/project/ownership'
import { seoHead } from '#/features/seo/meta'

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
		await context.queryClient.query(
			ownershipQueries.list(context.auth.user.id, deps.page)
		)
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
	const navigate = Route.useNavigate()
	const { page = 1, claimsPage = 1 } = Route.useSearch()
	const projects = useSuspenseQuery(
		ownershipQueries.list(auth.user.id, page)
	).data

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
									{item.status === 'published' && <VerifiedBadge />}
								</h2>
								<p className="text-sm text-muted-foreground">
									{item.role} · {item.status}
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<Link
									to="/managed/$id/members"
									params={{ id: item.id }}
									className={buttonVariants({ variant: 'outline' })}
								>
									Members
								</Link>
								{item.status === 'published' && (
									<Link
										to="/managed/$id"
										params={{ id: item.id }}
										className={buttonVariants({})}
									>
										Manage project
									</Link>
								)}
							</div>
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
				{auth.user.role === 'admin' ? (
					<Link
						to="/admin/ownership"
						className={buttonVariants({ variant: 'outline' })}
					>
						Open ownership review queue
					</Link>
				) : (
					<ClaimInbox
						page={claimsPage}
						onPageChange={(nextPage) =>
							void navigate({
								search: (previous) => {
									return { ...previous, claimsPage: nextPage }
								},
							})
						}
					/>
				)}
			</section>
		</main>
	)
}
