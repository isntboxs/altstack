import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useRouter } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'

import {
	claimBodySchema,
	projectMemberRoleSchema,
} from '@altstack/shared/schemas/ownership'

import { Alert, AlertDescription } from '@altstack/ui/components/alert'
import { Button } from '@altstack/ui/components/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
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
import { Spinner } from '@altstack/ui/components/spinner'

import { SignInForm } from '#/components/sign-in-form'
import { ownershipQueries } from '#/features/project/ownership'
import { invalidateCatalog } from '#/utils/invalidate-catalog'
import { client } from '#/utils/orpc'

export function ProjectVerifyDialog({
	projectId,
	name,
	userId,
	open,
	onOpenChange,
	finalFocus,
}: {
	projectId: string
	name: string
	userId?: string
	open: boolean
	onOpenChange: (open: boolean) => void
	finalFocus: () => HTMLElement | null
}) {
	const { href } = useLocation()
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-y-auto sm:max-w-md"
				finalFocus={finalFocus}
			>
				<DialogHeader className="min-w-0 pr-6">
					<DialogTitle className="wrap-anywhere">Verify {name}</DialogTitle>
					<DialogDescription>
						Confirm that you represent this project. Verify your contact email,
						then get approval from a project representative, or AltStack admin
						for its first claim.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-3 text-sm text-muted-foreground">
					<p>
						Approved projects receive a verified badge, appear first in the
						default home listing, and let you:
					</p>
					<ul className="list-disc pl-5">
						<li>Update project information</li>
						<li>Manage its categories</li>
						<li>Give its listing extra exposure</li>
					</ul>
				</div>
				{open &&
					(userId ? (
						<VerificationForm
							key={`${projectId}:${userId}`}
							projectId={projectId}
							userId={userId}
							onClose={() => onOpenChange(false)}
						/>
					) : (
						<>
							<p className="text-sm">
								Sign in to attach this request to your account.
							</p>
							<SignInForm returnTo={href} />
						</>
					))}
			</DialogContent>
		</Dialog>
	)
}

function VerificationForm({
	projectId,
	userId,
	onClose,
}: {
	projectId: string
	userId: string
	onClose: () => void
}) {
	const id = useId()
	const queryClient = useQueryClient()
	const router = useRouter()
	const [email, setEmail] = useState<string>()
	const [role, setRole] = useState<'owner' | 'maintainer'>()
	const [code, setCode] = useState('')
	const [editing, setEditing] = useState(false)
	const [error, setError] = useState('')
	const [now, setNow] = useState(Date.now)
	const sending = useRef(false)
	const queryOptions = ownershipQueries.state(userId, projectId)
	const queryKey = queryOptions.queryKey
	const state = useQuery({
		...queryOptions,
		retry: false,
		refetchInterval: 15000,
	})
	const send = useMutation({
		mutationFn: () =>
			client.ownership.request({
				params: { id: projectId },
				body: claimBodySchema.parse({
					email: selectedEmail,
					role: selectedRole,
				}),
			}),
		retry: false,
	})
	const verify = useMutation({
		mutationFn: (challengeId: string) =>
			client.ownership.verify({
				params: { id: projectId },
				body: { challengeId, code },
			}),
		retry: false,
	})
	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 1000)
		return () => window.clearInterval(timer)
	}, [])
	const selectedEmail = email ?? state.data?.claim?.email ?? ''
	const selectedRole = role ?? state.data?.claim?.role ?? 'owner'
	const currentChallenge = !editing
		? (send.data ?? state.data?.claim?.challenge)
		: null
	const resendAt = send.data?.resendAt ?? state.data?.claim?.challenge?.resendAt
	const cooldown = resendAt
		? Math.max(0, Math.ceil((resendAt.getTime() - now) / 1000))
		: 0
	const codeRef = useRef<HTMLInputElement>(null)
	const emailRef = useRef<HTMLInputElement>(null)
	const challengeId = currentChallenge?.challengeId
	const membership = state.data?.membership
	const claimStatus = state.data?.claim?.status
	useEffect(() => {
		if (
			state.isSuccess &&
			!challengeId &&
			!membership &&
			claimStatus !== 'pending'
		) {
			emailRef.current?.focus()
		}
	}, [state.isSuccess, challengeId, membership, claimStatus])
	useEffect(() => {
		if (challengeId) codeRef.current?.focus()
	}, [challengeId])
	useEffect(() => {
		if (state.data?.membership) {
			void invalidateCatalog(queryClient)
			void router.invalidate()
		}
	}, [state.data?.membership, queryClient, router])
	const expired = currentChallenge
		? currentChallenge.expiresAt.getTime() <= now
		: false
	const pending = send.isPending || verify.isPending
	async function requestCode(event?: React.SyntheticEvent) {
		event?.preventDefault()
		if (sending.current) return
		const parsed = claimBodySchema.safeParse({
			email: selectedEmail,
			role: selectedRole,
		})
		if (!parsed.success) {
			setError(parsed.error.issues[0]?.message ?? 'Enter a valid email.')
			return
		}
		sending.current = true
		setError('')
		try {
			await send.mutateAsync()
			setCode('')
			setEditing(false)
			setNow(Date.now())
		} catch (reason) {
			setError(
				reason instanceof Error
					? reason.message
					: 'Unable to send the code. Please try again.'
			)
		} finally {
			sending.current = false
		}
	}
	async function confirm(event: React.SyntheticEvent) {
		event.preventDefault()
		if (!currentChallenge || sending.current) return
		if (!/^\d{6}$/.test(code)) {
			setError('Enter the six-digit code.')
			return
		}
		sending.current = true
		setError('')
		try {
			await verify.mutateAsync(currentChallenge.challengeId)
			await queryClient.invalidateQueries({ queryKey })
			await router.invalidate()
		} catch (reason) {
			setError(
				reason instanceof Error
					? reason.message
					: 'Unable to verify the code. Please try again.'
			)
		} finally {
			sending.current = false
		}
	}
	if (state.isPending) {
		return (
			<output className="flex items-center gap-2 text-sm">
				<Spinner /> Loading your request…
			</output>
		)
	}
	if (state.isError) {
		return (
			<div className="flex flex-col gap-3">
				<p role="alert">Unable to load your request.</p>
				<Button variant="outline" onClick={() => void state.refetch()}>
					Retry
				</Button>
			</div>
		)
	}
	if (state.data.membership) {
		return (
			<div className="flex flex-col gap-4">
				<output>
					You are an approved {state.data.membership} of this project.
				</output>
				<Button render={<Link to="/managed/$id" params={{ id: projectId }} />}>
					Manage project
				</Button>
			</div>
		)
	}
	if (state.data.claim?.status === 'pending') {
		return (
			<div className="flex flex-col gap-4">
				<output>
					Email confirmed. Your {state.data.claim.role} request is awaiting
					approval. Access and the project badge activate after approval.
				</output>
				<Button variant="outline" onClick={onClose}>
					Done
				</Button>
			</div>
		)
	}
	return (
		<form
			onSubmit={currentChallenge ? confirm : requestCode}
			className="flex min-w-0 flex-col gap-5"
			aria-busy={pending}
		>
			{state.data.claim?.status === 'rejected' && (
				<p className="text-sm text-muted-foreground">
					Your previous request was declined. Confirm your details before
					requesting access again.
				</p>
			)}
			{currentChallenge ? (
				<>
					<p className="text-sm wrap-anywhere">
						Enter the code sent to <strong>{selectedEmail}</strong> for your{' '}
						{selectedRole} request.
					</p>
					<Field>
						<FieldLabel htmlFor={`${id}-code`}>Verification code</FieldLabel>
						<Input
							ref={codeRef}
							id={`${id}-code`}
							inputMode="numeric"
							autoComplete="one-time-code"
							pattern="[0-9]{6}"
							maxLength={6}
							required
							value={code}
							onChange={(event) =>
								setCode(event.target.value.replace(/\D/g, ''))
							}
							disabled={pending}
						/>
					</Field>
					<p className="text-sm text-muted-foreground">
						{expired
							? 'This code has expired. Request a new code.'
							: `Code expires in ${Math.max(1, Math.ceil((currentChallenge.expiresAt.getTime() - now) / 60000))} minutes.`}
					</p>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							size="sm"
							variant="ghost"
							disabled={pending || cooldown > 0}
							onClick={() => void requestCode()}
						>
							{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							disabled={pending}
							onClick={() => {
								setEditing(true)
								setCode('')
								setError('')
							}}
						>
							Change email or role
						</Button>
					</div>
				</>
			) : (
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor={`${id}-email`}>Email address</FieldLabel>
						<Input
							ref={emailRef}
							id={`${id}-email`}
							type="email"
							autoComplete="email"
							required
							maxLength={254}
							placeholder="Your project contact email"
							value={selectedEmail}
							onChange={(event) => setEmail(event.target.value)}
							disabled={pending}
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor={`${id}-role`}>Your role</FieldLabel>
						<Select
							value={selectedRole}
							items={[
								{ label: 'Owner', value: 'owner' },
								{ label: 'Maintainer', value: 'maintainer' },
							]}
							onValueChange={(value) => {
								const parsed = projectMemberRoleSchema.safeParse(value)
								if (parsed.success) setRole(parsed.data)
							}}
							disabled={pending}
						>
							<SelectTrigger id={`${id}-role`}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectItem value="owner">Owner</SelectItem>
									<SelectItem value="maintainer">Maintainer</SelectItem>
								</SelectGroup>
							</SelectContent>
						</Select>
						<p className="text-xs text-muted-foreground">
							Both roles have the same permissions for this project.
						</p>
					</Field>
				</FieldGroup>
			)}
			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
			<DialogFooter className="flex-row justify-between sm:justify-between">
				<Button type="button" variant="outline" onClick={onClose}>
					Cancel
				</Button>
				<Button
					type="submit"
					disabled={pending || (currentChallenge ? expired : cooldown > 0)}
				>
					{pending && <Spinner />}
					{currentChallenge
						? verify.isPending
							? 'Confirming…'
							: 'Confirm code'
						: send.isPending
							? 'Sending…'
							: 'Send verification code'}
				</Button>
			</DialogFooter>
		</form>
	)
}
