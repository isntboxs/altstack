import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { Alert, AlertDescription } from '@altstack/ui/components/alert'
import { Badge } from '@altstack/ui/components/badge'
import { Button } from '@altstack/ui/components/button'
import {
	Empty,
	EmptyHeader,
	EmptyTitle,
	EmptyDescription,
} from '@altstack/ui/components/empty'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@altstack/ui/components/table'

import { ActionConfirmation } from '#/components/action-confirmation'
import { adminUsersKey } from '#/features/admin-users/queries'
import { ownershipKey, ownershipQueries } from '#/features/project/ownership'
import { invalidateCatalog } from '#/utils/invalidate-catalog'
import { client } from '#/utils/orpc'

type Member = ORPCRouterOutputs['ownership']['members']['members'][number]
type Change = { action: 'role' | 'revoke' | 'leave'; member: Member }

export function ProjectMembers({ id, userId }: { id: string; userId: string }) {
	const [page, setPage] = useState(1)
	const query = useQuery(ownershipQueries.members(userId, id, page))
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const [change, setChange] = useState<Change | null>(null)
	const mutation = useMutation({
		mutationFn: ({ action, member }: Change) => {
			const body = { revision: member.revision }
			if (action === 'leave') {
				return client.ownership.leave({ params: { id }, body })
			}
			const params = { id, userId: member.userId }
			return action === 'revoke'
				? client.ownership.revokeMember({ params, body })
				: client.ownership.changeMemberRole({
						params,
						body: {
							...body,
							role: member.role === 'owner' ? 'maintainer' : 'owner',
						},
					})
		},
		retry: false,
		onSuccess: async (_, variables) => {
			setChange(null)
			// Leaving removes the private editor and its cached upload/category data.
			if (variables.action === 'leave') {
				queryClient.removeQueries({ queryKey: ownershipKey })
				await navigate({ to: '/managed' })
			} else await queryClient.invalidateQueries({ queryKey: ownershipKey })
			await queryClient.invalidateQueries({ queryKey: adminUsersKey })
			await invalidateCatalog(queryClient)
		},
	})
	const open = (value: Change) => {
		mutation.reset()
		setChange(value)
	}
	return (
		<section aria-label="Project members" className="flex flex-col gap-4">
			<header className="flex flex-col gap-2">
				<h2 className="text-lg font-semibold">
					{query.data
						? `${query.data.project.name} members`
						: 'Project members'}
				</h2>
				<p className="text-sm text-muted-foreground">
					Owners and maintainers can edit and review access requests equally.
					Admins change roles or revoke another member. You can leave your own
					project.
				</p>
			</header>
			{query.isPending && <output>Loading members…</output>}
			{query.error && (
				<Alert variant="destructive">
					<AlertDescription>
						Members unavailable or access not granted.
					</AlertDescription>
				</Alert>
			)}
			<Button
				variant="outline"
				className="self-start"
				disabled={query.isFetching || mutation.isPending}
				onClick={() => {
					setChange(null)
					mutation.reset()
					void query.refetch()
				}}
			>
				Refresh members
			</Button>
			{query.data && (
				<>
					<Table aria-label="Project members">
						<TableHeader>
							<TableRow>
								<TableHead>Member</TableHead>
								<TableHead>Project role</TableHead>
								<TableHead>Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{query.data.members.map((member) => (
								<TableRow key={member.userId}>
									<TableCell>
										<span className="wrap-anywhere">
											{member.name}
											{member.userId === userId ? ' (you)' : ''}
										</span>
										{!member.active && (
											<Badge variant="secondary">Account banned</Badge>
										)}
									</TableCell>
									<TableCell>{member.role}</TableCell>
									<TableCell>
										<div className="flex flex-wrap gap-2">
											{query.data.canManage && (
												<Link
													to="/admin/users/$id"
													params={{ id: member.userId }}
													className="text-sm underline underline-offset-4"
												>
													View user
												</Link>
											)}
											{query.data.canManage && member.userId !== userId && (
												<>
													<Button
														variant="outline"
														size="sm"
														disabled={mutation.isPending}
														onClick={() => open({ action: 'role', member })}
													>
														Change to{' '}
														{member.role === 'owner' ? 'maintainer' : 'owner'}
													</Button>
													<Button
														variant="destructive"
														size="sm"
														disabled={mutation.isPending}
														onClick={() => open({ action: 'revoke', member })}
													>
														Revoke {member.name}
													</Button>
												</>
											)}
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					{query.data.members.length === 0 && (
						<Empty>
							<EmptyHeader>
								<EmptyTitle>No approved members</EmptyTitle>
								<EmptyDescription>
									A new representative must request access and receive admin
									approval.
								</EmptyDescription>
							</EmptyHeader>
						</Empty>
					)}
					<nav aria-label="Member pages" className="flex items-center gap-3">
						<Button
							variant="outline"
							disabled={page === 1 || query.isFetching}
							onClick={() => setPage(page - 1)}
						>
							Previous members
						</Button>
						<span className="text-sm">Page {page}</span>
						<Button
							variant="outline"
							disabled={!query.data.pagination.hasNextPage || query.isFetching}
							onClick={() => setPage(page + 1)}
						>
							Next members
						</Button>
					</nav>
					{query.data.self && (
						<Button
							variant="outline"
							className="self-start"
							disabled={mutation.isPending}
							onClick={() =>
								open({ action: 'leave', member: query.data.self! })
							}
						>
							Leave project
						</Button>
					)}
				</>
			)}
			<ActionConfirmation
				open={change !== null}
				title={
					change?.action === 'leave'
						? 'Leave project?'
						: change?.action === 'revoke'
							? `Revoke ${change.member.name}?`
							: 'Change project role?'
				}
				description={
					change?.action === 'role'
						? 'This changes the project label. Both roles keep the same edit and review permissions; account roles stay separate.'
						: 'Project editing, uploads and access reviews end immediately. If no active representatives remain, the verified badge is removed. Returning requires a new email code and independent approval.'
				}
				pending={mutation.isPending}
				error={mutation.error?.message}
				onClose={() => setChange(null)}
				onConfirm={() => {
					if (change) mutation.mutate(change)
				}}
			/>
		</section>
	)
}
