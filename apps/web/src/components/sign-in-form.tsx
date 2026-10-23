import { IconBrandGithub, IconMail } from '@tabler/icons-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { SubmitEvent } from 'react'
import { z } from 'zod'

import { authClient } from '@altstack/auth/client'

import { env } from '@altstack/env/web'

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@altstack/ui/components/alert'
import { Button } from '@altstack/ui/components/button'
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from '@altstack/ui/components/field'
import { Input } from '@altstack/ui/components/input'
import { Separator } from '@altstack/ui/components/separator'
import { Spinner } from '@altstack/ui/components/spinner'

import { resolveReturnTo } from '#/utils/return-to'

export const signInDescription =
	'Join the open source community and get access to the dashboard.'

function verificationError(error?: string) {
	if (!error) return null
	if (['INVALID_TOKEN', 'EXPIRED_TOKEN'].includes(error)) {
		return 'This sign-in link is invalid, has expired, or has already been used. Request a new link below.'
	}
	return 'We could not complete sign-in. Please try again or request a new link.'
}

export function SignInForm({
	returnTo,
	authError,
}: {
	returnTo?: string
	authError?: string
}) {
	const id = useId()
	const [email, setEmail] = useState('')
	const [sentTo, setSentTo] = useState<string | null>(null)
	const [pending, setPending] = useState<'email' | 'github' | null>(null)
	const [emailError, setEmailError] = useState<string | null>(null)
	const [requestError, setRequestError] = useState<string | null>(null)
	const [retryIn, setRetryIn] = useState(0)
	const busy = useRef(false)
	const localReturnTo = resolveReturnTo(returnTo, '/')
	const callbackURL = new URL(localReturnTo, env.VITE_APP_URL).toString()
	const errorCallback = new URL('/auth/sign-in', env.VITE_APP_URL)
	errorCallback.searchParams.set('returnTo', localReturnTo)
	const errorCallbackURL = errorCallback.toString()

	useEffect(() => {
		if (retryIn <= 0) return
		const timer = window.setTimeout(
			() => setRetryIn((seconds) => Math.max(0, seconds - 1)),
			1000
		)
		return () => window.clearTimeout(timer)
	}, [retryIn])

	const sendLink = async (event: SubmitEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (busy.current || retryIn > 0) return
		const parsed = z.email().max(254).safeParse(email.trim().toLowerCase())
		if (!parsed.success) {
			setEmailError('Enter a valid email address.')
			return
		}
		busy.current = true
		setEmailError(null)
		setRequestError(null)
		setPending('email')
		try {
			const { error } = await authClient.signIn.magicLink({
				email: parsed.data,
				callbackURL,
				newUserCallbackURL: callbackURL,
				errorCallbackURL,
				fetchOptions: {
					onError: ({ response }) => {
						if (response.status === 429) {
							const seconds = Number(
								response.headers.get('X-Retry-After') ??
									response.headers.get('Retry-After')
							)
							setRetryIn(
								Number.isFinite(seconds) && seconds > 0
									? Math.ceil(seconds)
									: 60
							)
						}
					},
				},
			})
			if (error) {
				setRequestError(
					error.status === 429
						? 'Too many requests. Wait before requesting another link.'
						: 'Unable to send a sign-in email. Try again later or continue with GitHub.'
				)
				return
			}
			setEmail(parsed.data)
			setSentTo(parsed.data)
			setRetryIn(60)
		} catch {
			setRequestError('Unable to connect. Check your connection and try again.')
		} finally {
			busy.current = false
			setPending(null)
		}
	}

	const signInWithGithub = async () => {
		if (busy.current) return
		busy.current = true
		setPending('github')
		setRequestError(null)
		try {
			const { error } = await authClient.signIn.social({
				provider: 'github',
				callbackURL,
				errorCallbackURL,
			})
			if (error) {
				setRequestError('Unable to continue with GitHub. Please try again.')
			}
		} catch {
			setRequestError('Unable to connect. Check your connection and try again.')
		} finally {
			busy.current = false
			setPending(null)
		}
	}

	const error = requestError ?? (sentTo ? null : verificationError(authError))
	return (
		<div className="flex flex-col gap-5">
			{error && (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}
			{sentTo && (
				<Alert aria-live="polite">
					<IconMail aria-hidden="true" />
					<AlertTitle>Check your inbox</AlertTitle>
					<AlertDescription>
						We sent a sign-in link to{' '}
						<span className="font-medium break-all">{sentTo}</span>. It expires
						in 10 minutes. Check your spam folder too.
					</AlertDescription>
				</Alert>
			)}
			<form
				onSubmit={sendLink}
				noValidate
				aria-label="Sign in with email"
				aria-busy={pending === 'email'}
			>
				<FieldGroup className="gap-3">
					<Field data-invalid={Boolean(emailError)}>
						<FieldLabel htmlFor={id} className="sr-only">
							Email
						</FieldLabel>
						<Input
							id={id}
							name="email"
							type="email"
							autoComplete="email"
							inputMode="email"
							placeholder="Enter your email"
							required
							maxLength={254}
							value={email}
							disabled={pending !== null}
							aria-invalid={Boolean(emailError)}
							aria-describedby={emailError ? `${id}-error` : undefined}
							onChange={(event) => {
								setEmail(event.target.value)
								setEmailError(null)
							}}
							className="h-10"
						/>
						{emailError && (
							<FieldError id={`${id}-error`}>{emailError}</FieldError>
						)}
					</Field>
					<Button
						type="submit"
						size="lg"
						className="h-10 w-full justify-between"
						disabled={pending !== null || retryIn > 0}
					>
						<span>
							{pending === 'email'
								? 'Sending magic link…'
								: retryIn > 0
									? `Resend in ${retryIn}s`
									: sentTo
										? 'Resend magic link'
										: 'Send me a magic link'}
						</span>
						{pending === 'email' ? (
							<Spinner data-icon="inline-end" aria-hidden="true" />
						) : (
							<IconMail data-icon="inline-end" aria-hidden="true" />
						)}
					</Button>
				</FieldGroup>
			</form>
			<div className="flex items-center gap-3">
				<Separator className="flex-1" />
				<span className="text-sm text-muted-foreground">or</span>
				<Separator className="flex-1" />
			</div>
			<Button
				type="button"
				variant="outline"
				size="lg"
				className="h-10 w-full justify-between"
				onClick={signInWithGithub}
				disabled={pending !== null}
			>
				<span>Continue with GitHub</span>
				{pending === 'github' ? (
					<Spinner data-icon="inline-end" aria-hidden="true" />
				) : (
					<IconBrandGithub data-icon="inline-end" aria-hidden="true" />
				)}
			</Button>
		</div>
	)
}
