import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { sendMagicLinkEmail } from '../src/server/magic-link-email'

const { env, send } = vi.hoisted(() => {
	const config: { RESEND_API_KEY: string; RESEND_FROM_EMAIL?: string } = {
		RESEND_API_KEY: 're_synthetic',
		RESEND_FROM_EMAIL: 'sign-in@example.test',
	}
	return {
		env: { ...config, CORS_ORIGINS: ['https://app.example.test'] },
		send: vi.fn(),
	}
})
vi.mock('@altstack/env/server', () => {
	return { env }
})
vi.mock('resend', () => {
	return {
		Resend: class {
			emails = { send }
		},
	}
})

beforeEach(() => {
	env.RESEND_FROM_EMAIL = 'sign-in@example.test'
	send
		.mockReset()
		.mockResolvedValue({ data: { id: 'synthetic-email' }, error: null })
})

describe('transactional Magic Link email', () => {
	it('renders HTML and plain text and delivers through Resend without logging the link', async () => {
		const url =
			'https://api.example.test/api/auth/magic-link/verify?token=synthetic&callbackURL=https%3A%2F%2Fapp.example.test%2Fsubmit'
		await sendMagicLinkEmail({ email: 'recipient@example.test', url })
		expect(send).toHaveBeenCalledTimes(1)
		const payload = send.mock.calls[0]![0] as {
			html: string
			text: string
			from: string
			to: string
			subject: string
		}
		expect(payload.from).toBe('AltStack <sign-in@example.test>')
		expect(payload.to).toBe('recipient@example.test')
		expect(payload.subject).toBe('Sign in to AltStack')
		expect(payload.html.includes('Sign in to AltStack')).toBe(true)
		expect(payload.text.includes(url)).toBe(true)
		expect(payload.text).toContain('10 minutes')
		expect(payload.text).toContain('only be used once')
	})
	it('fails closed when a verified sender is not configured', async () => {
		env.RESEND_FROM_EMAIL = undefined
		await expect(
			sendMagicLinkEmail({
				email: 'recipient@example.test',
				url: 'https://example.test',
			})
		).rejects.toMatchObject({ status: 'SERVICE_UNAVAILABLE' })
		expect(send).not.toHaveBeenCalled()
	})
	it.each(['response', 'exception'])(
		'returns a generic retryable error on a provider %s without leaking details',
		async (kind) => {
			if (kind === 'response') {
				send.mockResolvedValue({
					error: { message: 'private provider response' },
				})
			} else send.mockRejectedValue(new Error('private provider response'))
			const error: unknown = await sendMagicLinkEmail({
				email: 'recipient@example.test',
				url: 'https://example.test',
			}).catch((failure: unknown) => failure)
			expect(error).toMatchObject({ status: 'SERVICE_UNAVAILABLE' })
			expect(String(error)).not.toContain('private provider response')
		}
	)
})
