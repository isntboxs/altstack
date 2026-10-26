import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'

import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@altstack/ui/components/table'

import { PublicError } from '#/components/public-page-state'
import { UserActions } from '#/features/admin-users/components/user-actions'
import { adminUserQueries } from '#/features/admin-users/queries'
import { seoHead } from '#/features/seo/meta'

export const Route = createFileRoute('/_main/admin/users/$id')({
	beforeLoad: ({ context: { auth } }) => {
		if (auth.user.role !== 'admin') throw redirect({ to: '/', replace: true })
	},
	loader: async ({ context, params }) => {
		await context.queryClient.query(
			adminUserQueries.get(context.auth.user.id, params.id)
		)
	},
	head: () =>
		seoHead({
			title: 'User details | AltStack',
			description: 'Admin account details.',
			noindex: true,
		}),
	errorComponent: () => (
		<PublicError title="User unavailable or admin access not granted" />
	),
	component: UserPage,
})
function UserPage() {
	const { auth } = Route.useRouteContext()
	const { id } = Route.useParams()
	const query = useSuspenseQuery(adminUserQueries.get(auth.user.id, id))
	const { user, providers, activeSessions, memberships } = query.data
	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-8">
			<Link to="/admin/users" className="text-sm underline underline-offset-4">
				All users
			</Link>
			<header className="flex flex-col gap-2">
				<h1 className="text-2xl font-semibold">{user.name}</h1>
				<p className="wrap-anywhere">{user.email}</p>
				<div className="flex gap-2">
					<Badge variant="secondary">{user.role}</Badge>
					<Badge variant="secondary">{user.banned ? 'Banned' : 'Active'}</Badge>
				</div>
			</header>
			<dl className="grid gap-2 text-sm sm:grid-cols-2">
				<dt>Email verified</dt>
				<dd>{user.emailVerified ? 'Yes' : 'No'}</dd>
				<dt>Sign-in providers</dt>
				<dd>
					{providers
						.filter((provider) => provider !== 'credential')
						.join(', ') || 'No linked OAuth provider'}
				</dd>
				<dt>Active sessions</dt>
				<dd>{activeSessions}</dd>
				<dt>Joined</dt>
				<dd>{new Date(user.createdAt).toLocaleDateString('en-GB')}</dd>
				{user.banned && (
					<>
						<dt>Ban reason</dt>
						<dd className="wrap-anywhere">
							{user.banReason ?? 'No reason recorded'}
						</dd>
						<dt>Ban expires</dt>
						<dd>
							{user.banExpires
								? new Date(user.banExpires).toLocaleString('en-GB')
								: 'Until an admin unbans this account'}
						</dd>
					</>
				)}
			</dl>
			<Button
				variant="outline"
				className="self-start"
				disabled={query.isFetching}
				onClick={() => void query.refetch()}
			>
				Refresh user
			</Button>
			<UserActions user={user} actorId={auth.user.id} />
			<section
				aria-label="Approved project memberships"
				className="flex flex-col gap-3"
			>
				<h2 className="text-lg font-semibold">Approved project memberships</h2>
				<p className="text-sm text-muted-foreground">
					Account roles do not grant project access. Changing a membership
					affects only that project.
				</p>
				<Table aria-label="User project memberships">
					<TableHeader>
						<TableRow>
							<TableHead>Project</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Project role</TableHead>
							<TableHead>Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{memberships.map((member) => (
							<TableRow key={member.projectId}>
								<TableCell>{member.projectName}</TableCell>
								<TableCell>{member.status}</TableCell>
								<TableCell>{member.role}</TableCell>
								<TableCell>
									<Link
										to="/managed/$id/members"
										params={{ id: member.projectId }}
										className="underline underline-offset-4"
									>
										Manage members
									</Link>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				{memberships.length === 0 && (
					<p className="text-sm text-muted-foreground">
						No approved project memberships.
					</p>
				)}
			</section>
		</main>
	)
}
