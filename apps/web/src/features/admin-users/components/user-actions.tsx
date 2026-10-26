import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import type { ORPCRouterInputs, ORPCRouterOutputs } from '@altstack/api/routers'

import { Button } from '@altstack/ui/components/button'
import { Field, FieldGroup, FieldLabel } from '@altstack/ui/components/field'
import { Textarea } from '@altstack/ui/components/textarea'

import { ActionConfirmation } from '#/components/action-confirmation'
import { adminUsersKey } from '#/features/admin-users/queries'
import { ownershipKey } from '#/features/project/ownership'
import { invalidateCatalog } from '#/utils/invalidate-catalog'
import { client } from '#/utils/orpc'

type Action = ORPCRouterInputs['admin']['user']['action']['body']
export function UserActions({
	user,
	actorId,
}: {
	user: ORPCRouterOutputs['admin']['user']['get']['user']
	actorId: string
}) {
	const queryClient = useQueryClient()
	const [action, setAction] = useState<Action | null>(null)
	const [reason, setReason] = useState('')
	const mutation = useMutation({
		mutationFn: (body: Action) =>
			client.admin.user.action({ params: { id: user.id }, body }),
		retry: false,
		onSuccess: async (_, body) => {
			setAction(null)
			if (
				actorId === user.id &&
				(body.action === 'set-role' || body.action === 'revoke-sessions')
			) {
				queryClient.clear()
				window.location.assign('/')
				return
			}
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: adminUsersKey }),
				queryClient.invalidateQueries({ queryKey: ownershipKey }),
				invalidateCatalog(queryClient),
			])
		},
	})
	const open = (value: Action) => {
		mutation.reset()
		setReason('')
		setAction(value)
	}
	const descriptions: Record<Action['action'], string> = {
		'set-role':
			'This changes the global account role and signs out all sessions. Project memberships stay separate. At least one active admin must remain.',
		ban: 'This blocks sign-in and signs out all sessions until an admin unbans the account. Membership records are retained; this account stops counting as an active project representative.',
		unban:
			'This permits sign-in again and restores access to retained project memberships. Previously revoked sessions remain invalid.',
		'revoke-sessions':
			'This signs out all sessions for this account. The user can sign in again; their roles and project memberships stay the same.',
	}
	return (
		<section aria-label="User actions" className="flex flex-col gap-3">
			<h2 className="text-lg font-semibold">Account actions</h2>
			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					disabled={mutation.isPending}
					onClick={() =>
						open({
							action: 'set-role',
							revision: user.revision,
							role: user.role === 'admin' ? 'user' : 'admin',
						})
					}
				>
					{user.role === 'admin' ? 'Remove admin role' : 'Grant admin role'}
				</Button>
				<Button
					variant="outline"
					disabled={mutation.isPending}
					onClick={() =>
						open({ action: 'revoke-sessions', revision: user.revision })
					}
				>
					Revoke all sessions
				</Button>
				{user.banned ? (
					<Button
						variant="outline"
						disabled={mutation.isPending}
						onClick={() => open({ action: 'unban', revision: user.revision })}
					>
						Unban account
					</Button>
				) : (
					<Button
						variant="destructive"
						disabled={mutation.isPending || user.id === actorId}
						onClick={() =>
							open({ action: 'ban', revision: user.revision, reason: '' })
						}
					>
						Ban account
					</Button>
				)}
			</div>
			<ActionConfirmation
				open={action !== null}
				title={
					action?.action === 'set-role'
						? `Set ${user.name} to ${action.role}?`
						: action?.action === 'ban'
							? `Ban ${user.name}?`
							: action?.action === 'unban'
								? `Unban ${user.name}?`
								: `Revoke sessions for ${user.name}?`
				}
				description={action ? descriptions[action.action] : ''}
				pending={mutation.isPending}
				error={mutation.error?.message}
				disabled={action?.action === 'ban' && !reason.trim()}
				onClose={() => setAction(null)}
				onConfirm={() => {
					if (action) {
						mutation.mutate(
							action.action === 'ban'
								? { ...action, reason: reason.trim() }
								: action
						)
					}
				}}
			>
				{action?.action === 'ban' && (
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="ban-reason">Reason for ban</FieldLabel>
							<Textarea
								id="ban-reason"
								value={reason}
								onChange={(event) => setReason(event.target.value)}
								maxLength={1000}
								disabled={mutation.isPending}
								required
							/>
						</Field>
					</FieldGroup>
				)}
			</ActionConfirmation>
		</section>
	)
}
