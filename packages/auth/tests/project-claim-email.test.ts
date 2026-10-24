import { beforeEach, expect, it, vi } from 'vite-plus/test'

import { sendProjectClaimEmail } from '../src/server/project-claim-email'

const { env, send } = vi.hoisted(() => {
	const config: {
		RESEND_API_KEY: string
		RESEND_FROM_EMAIL?: string
		CORS_ORIGINS: Array<string>
	} = {
		RESEND_API_KEY: 're_synthetic',
		RESEND_FROM_EMAIL: 'verification@example.test',
		CORS_ORIGINS: ['https://app.example.test'],
	}
	return { env: config, send: vi.fn() }
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
	env.RESEND_FROM_EMAIL = 'verification@example.test'
	send.mockReset().mockResolvedValue({ data: { id: 'synthetic' }, error: null })
})

it('sends branded escaped HTML and plain text with the claim role, code and expiry through Resend', async () => {
	await sendProjectClaimEmail({
		email: 'person@example.test',
		code: '012345',
		projectName: '<script>unsafe</script>',
		role: 'maintainer',
	})
	const payload = send.mock.calls[0]![0] as {
		html: string
		text: string
		to: string
		from: string
	}
	expect(payload.from).toBe('AltStack <verification@example.test>')
	expect(payload.to).toBe('person@example.test')
	expect(payload.html).not.toContain('<script>unsafe</script>')
	expect(payload.text).toContain('012345')
	expect(payload.text).toContain('maintainer')
	expect(payload.text).toContain('10 minutes')
	expect(payload.text).toContain('must approve your request')
})
it('fails closed without a sender and conceals provider failures', async () => {
	env.RESEND_FROM_EMAIL = undefined
	const input = {
		email: 'person@example.test',
		code: '012345',
		projectName: 'Example',
		role: 'owner' as const,
	}
	await expect(sendProjectClaimEmail(input)).rejects.toThrow(
		'Claim email unavailable'
	)
	expect(send).not.toHaveBeenCalled()
	env.RESEND_FROM_EMAIL = 'verification@example.test'
	send.mockRejectedValue(new Error('sensitive provider response'))
	await expect(sendProjectClaimEmail(input)).rejects.toThrow(
		'Claim email unavailable'
	)
})
