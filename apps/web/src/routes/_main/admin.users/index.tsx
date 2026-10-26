import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'

import { adminUserSearchSchema } from '@altstack/shared/schemas/admin-user'

import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import {
	Empty,
	EmptyHeader,
	EmptyTitle,
	EmptyDescription,
} from '@altstack/ui/components/empty'
import { Field, FieldLabel, FieldGroup } from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import {
	NativeSelect,
	NativeSelectOption,
} from '@altstack/ui/components/native-select'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@altstack/ui/components/table'

import { PublicError } from '#/components/public-page-state'
import { adminUserQueries } from '#/features/admin-users/queries'
import { seoHead } from '#/features/seo/meta'

export const Route = createFileRoute('/_main/admin/users/')({
	validateSearch: adminUserSearchSchema,
	loaderDeps: ({ search: { q, role, status, page } }) => {
		return {
			q,
			role,
			status,
			page,
		}
	},
	beforeLoad: ({ context: { auth } }) => {
		if (auth.user.role !== 'admin') throw redirect({ to: '/', replace: true })
	},
	loader: async ({ context, deps }) => {
		await context.queryClient.query(
			adminUserQueries.list(context.auth.user.id, deps)
		)
	},
	head: () =>
		seoHead({
			title: 'Users | AltStack',
			description: 'Admin user management.',
			noindex: true,
		}),
	errorComponent: () => (
		<PublicError title="Users unavailable or admin access not granted" />
	),
	component: UsersPage,
})
function UsersPage() {
	const { auth } = Route.useRouteContext()
	const search = Route.useSearch()
	const navigate = Route.useNavigate()
	const query = useSuspenseQuery(adminUserQueries.list(auth.user.id, search))
	const { users, pagination } = query.data
	return (
		<main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-8">
			<header>
				<h1 className="text-2xl font-semibold">Users</h1>
				<p className="text-sm text-muted-foreground">
					Manage account access and inspect approved project memberships.
				</p>
			</header>
			<form
				key={JSON.stringify(search)}
				onSubmit={(event) => {
					event.preventDefault()
					const values = new FormData(event.currentTarget)
					void navigate({
						search: adminUserSearchSchema.parse({
							q: values.get('q'),
							role: values.get('role'),
							status: values.get('status'),
							page: 1,
						}),
					})
				}}
			>
				<FieldGroup className="flex flex-wrap gap-3 md:flex-row">
					<Field>
						<FieldLabel htmlFor="user-search">Search name or email</FieldLabel>
						<Input
							id="user-search"
							name="q"
							defaultValue={search.q ?? ''}
							maxLength={200}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="user-role">Account role</FieldLabel>
						<NativeSelect
							id="user-role"
							name="role"
							defaultValue={search.role ?? 'all'}
						>
							{['all', 'admin', 'user', 'owner', 'maintainer'].map((role) => (
								<NativeSelectOption key={role} value={role}>
									{role}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel htmlFor="user-status">Account status</FieldLabel>
						<NativeSelect
							id="user-status"
							name="status"
							defaultValue={search.status ?? 'all'}
						>
							{['all', 'active', 'banned'].map((status) => (
								<NativeSelectOption key={status} value={status}>
									{status}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Field>
				</FieldGroup>
				<Button type="submit" className="mt-3">
					Search users
				</Button>
			</form>
			<Button
				variant="outline"
				className="self-start"
				onClick={() => void query.refetch()}
				disabled={query.isFetching}
			>
				Refresh users
			</Button>
			<Table aria-label="Users">
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Email</TableHead>
						<TableHead>Account role</TableHead>
						<TableHead>Status</TableHead>
						<TableHead>Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{users.map((user) => (
						<TableRow key={user.id}>
							<TableCell>{user.name}</TableCell>
							<TableCell className="wrap-anywhere">{user.email}</TableCell>
							<TableCell>{user.role}</TableCell>
							<TableCell>
								<Badge variant="secondary">
									{user.banned ? 'Banned' : 'Active'}
								</Badge>
							</TableCell>
							<TableCell>
								<Link
									to="/admin/users/$id"
									params={{ id: user.id }}
									className="underline underline-offset-4"
								>
									View user
								</Link>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			{users.length === 0 && (
				<Empty>
					<EmptyHeader>
						<EmptyTitle>No users found</EmptyTitle>
						<EmptyDescription>
							Try another name, email or filter.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
			<nav aria-label="User pages" className="flex items-center gap-3">
				<Button
					variant="outline"
					disabled={!pagination.hasPreviousPage}
					onClick={() =>
						void navigate({
							search: { ...search, page: (search.page ?? 1) - 1 },
						})
					}
				>
					Previous users
				</Button>
				<span className="text-sm">
					Page {pagination.page} · {pagination.totalItems} users
				</span>
				<Button
					variant="outline"
					disabled={!pagination.hasNextPage}
					onClick={() =>
						void navigate({
							search: { ...search, page: (search.page ?? 1) + 1 },
						})
					}
				>
					Next users
				</Button>
			</nav>
		</main>
	)
}
