// @vitest-environment jsdom
import type * as TanStackRouter from '@tanstack/react-router'
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { AuthDialog } from '#/components/auth-dialog'
import { SignInForm } from '#/components/sign-in-form'
import { Route as AuthRoute } from '#/routes/auth/route'
import { Route as SignInRoute } from '#/routes/auth/sign-in'
import { resolveReturnTo } from '#/utils/return-to'

const { magicLink, social, search } = vi.hoisted(() => {
	return {
		magicLink: vi.fn(),
		social: vi.fn(),
		search: { returnTo: '/submit', error: undefined as string | undefined },
	}
})
vi.mock('@altstack/auth/client', () => {
	return {
		authClient: { signIn: { magicLink, social } },
	}
})
vi.mock('@altstack/env/web', () => {
	return {
		env: { VITE_APP_URL: 'https://app.example.test' },
	}
})
vi.mock('#/components/header', () => {
	return { Header: () => null }
})
vi.mock('@tanstack/react-router', async () => {
	const actual = await vi.importActual<typeof TanStackRouter>(
		'@tanstack/react-router'
	)
	return {
		...actual,
		createFileRoute: () => (options: unknown) => {
			return {
				options,
				useSearch: () => search,
			}
		},
	}
})

beforeEach(() => {
	magicLink
		.mockReset()
		.mockResolvedValue({ data: { status: true }, error: null })
	social.mockReset().mockResolvedValue({ data: {}, error: null })
	search.returnTo = '/submit'
	search.error = undefined
})
afterEach(() => {
	cleanup()
	vi.useRealTimers()
})

function submit(email = 'person@example.test') {
	fireEvent.change(screen.getByRole('textbox', { name: 'Email' }), {
		target: { value: email },
	})
	fireEvent.submit(screen.getByRole('form', { name: 'Sign in with email' }))
}

describe('shared auth form', () => {
	it('renders the same authorized methods in the dialog and standalone route', () => {
		const close = vi.fn()
		const dialog = render(
			<AuthDialog open onOpenChange={close} returnTo="/bookmarks" />
		)
		expect(screen.getByRole('dialog').textContent).toContain('Sign in')
		expect(
			screen.getByRole('button', { name: 'Send me a magic link' })
		).toBeDefined()
		expect(
			screen.getByRole('button', { name: 'Continue with GitHub' })
		).toBeDefined()
		expect(screen.queryByText(/Google/)).toBeNull()
		expect(screen.queryByLabelText(/password/i)).toBeNull()
		dialog.unmount()
		const Component = SignInRoute.options.component as () => React.ReactNode
		render(<Component />)
		expect(screen.getByText('Sign in')).toBeDefined()
		expect(
			screen.getByRole('button', { name: 'Send me a magic link' })
		).toBeDefined()
		expect(screen.getByRole('textbox', { name: 'Email' })).toBeDefined()
	})
	it('validates email before requesting mail', () => {
		render(<SignInForm />)
		submit('not-an-email')
		expect(screen.getByRole('alert').textContent).toContain('valid email')
		expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe(
			'true'
		)
		expect(magicLink).not.toHaveBeenCalled()
	})
	it('preserves sanitized local returnTo in both methods and in verification error recovery', async () => {
		render(<SignInForm returnTo="/bookmarks?from=menu" />)
		submit('Person@Example.TEST')
		await screen.findByText('Check your inbox')
		const options = magicLink.mock.calls[0][0] as {
			email: string
			callbackURL: string
			newUserCallbackURL: string
			errorCallbackURL: string
		}
		expect(options.email).toBe('person@example.test')
		expect(options.callbackURL).toBe(
			'https://app.example.test/bookmarks?from=menu'
		)
		expect(options.newUserCallbackURL).toBe(options.callbackURL)
		expect(new URL(options.errorCallbackURL).searchParams.get('returnTo')).toBe(
			'/bookmarks?from=menu'
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Continue with GitHub' })
		)
		await waitFor(() =>
			expect(social).toHaveBeenCalledWith({
				provider: 'github',
				callbackURL: options.callbackURL,
				errorCallbackURL: options.errorCallbackURL,
			})
		)
	})
	it('shows pending state, prevents double requests, and permits resend after the cooldown', async () => {
		vi.useFakeTimers()
		let finish!: (value: { error: null }) => void
		magicLink.mockReturnValueOnce(
			new Promise((resolve) => {
				finish = resolve
			})
		)
		render(<SignInForm />)
		submit()
		fireEvent.submit(screen.getByRole('form', { name: 'Sign in with email' }))
		expect(magicLink).toHaveBeenCalledTimes(1)
		expect(
			screen
				.getByRole('button', {
					name: 'Sending magic link…',
				})
				.hasAttribute('disabled')
		).toBe(true)
		expect(
			screen
				.getByRole('button', {
					name: 'Continue with GitHub',
				})
				.hasAttribute('disabled')
		).toBe(true)
		await act(async () => {
			finish({ error: null })
			await Promise.resolve()
		})
		expect(screen.getByText('Check your inbox')).toBeDefined()
		expect(screen.getByRole('button', { name: 'Resend in 60s' })).toBeDefined()
		// React schedules each one-second tick after the previous render.
		for (let second = 0; second < 60; second++) {
			await act(() => vi.advanceTimersByTimeAsync(1000))
		}
		fireEvent.click(screen.getByRole('button', { name: 'Resend magic link' }))
		await act(async () => {
			await Promise.resolve()
		})
		expect(magicLink).toHaveBeenCalledTimes(2)
	})
	it('keeps the dialog open and reports delivery failure without exposing provider details', async () => {
		magicLink.mockResolvedValue({
			error: { status: 503, message: 'sensitive provider details' },
		})
		const close = vi.fn()
		render(<AuthDialog open onOpenChange={close} />)
		submit()
		await screen.findByText(/Unable to send a sign-in email/)
		expect(close).not.toHaveBeenCalled()
		expect(screen.queryByText('sensitive provider details')).toBeNull()
		expect(screen.queryByText('Check your inbox')).toBeNull()
	})
	it('honors the server retry delay and leaves GitHub available', async () => {
		magicLink.mockImplementation(
			(options: {
				fetchOptions: { onError: (ctx: { response: Response }) => void }
			}) => {
				options.fetchOptions.onError({
					response: new Response(null, {
						status: 429,
						headers: { 'X-Retry-After': '600' },
					}),
				})
				return Promise.resolve({ error: { status: 429 } })
			}
		)
		render(<SignInForm />)
		submit()
		await screen.findByText(/Too many requests/)
		expect(
			screen
				.getByRole('button', {
					name: 'Resend in 600s',
				})
				.hasAttribute('disabled')
		).toBe(true)
		expect(
			screen
				.getByRole('button', {
					name: 'Continue with GitHub',
				})
				.hasAttribute('disabled')
		).toBe(false)
	})
	it('shows invalid/expired/consumed verification feedback on the actual sign-in route', () => {
		search.error = 'INVALID_TOKEN'
		const Component = SignInRoute.options.component as () => React.ReactNode
		render(<Component />)
		expect(screen.getByRole('alert').textContent).toContain(
			'invalid, has expired, or has already been used'
		)
		expect(
			screen.getByRole('button', { name: 'Send me a magic link' })
		).toBeDefined()
	})
	it('falls back to a configured local destination for malicious returnTo', async () => {
		render(<SignInForm returnTo="//evil.example/phish" />)
		submit()
		await screen.findByText('Check your inbox')
		const options = magicLink.mock.calls[0][0] as { callbackURL: string }
		expect(options.callbackURL).toBe('https://app.example.test/')
	})
})

describe('returnTo and auth route validation', () => {
	it.each([
		'https://evil.example',
		'//evil.example',
		'/\\evil.example',
		'/a/..//evil.example',
		'/%2f%2fevil.example',
		'/%5cevil.example',
		'/%00',
		'/auth/sign-in',
		'/bad%',
	])('rejects unsafe or recursive destination %s', (value) => {
		expect(resolveReturnTo(value, '/')).toBe('/')
	})
	it('retains a safe path, query and fragment', () => {
		expect(resolveReturnTo('/bookmarks?source=auth#saved', '/')).toBe(
			'/bookmarks?source=auth#saved'
		)
	})
	it('sanitizes route search params while retaining bounded verification errors', () => {
		const validate = AuthRoute.options.validateSearch as {
			parse: (raw: unknown) => { returnTo?: string; error?: string }
		}
		expect(
			validate.parse({ returnTo: '//evil.example', error: 'INVALID_TOKEN' })
		).toEqual({ returnTo: '/', error: 'INVALID_TOKEN' })
	})
})
