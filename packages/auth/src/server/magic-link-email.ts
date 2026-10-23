import { render } from '@react-email/render'
import { APIError } from 'better-auth/api'
import { createElement } from 'react'
import { Resend } from 'resend'

import { env } from '@altstack/env/server'

import { MagicLinkEmail } from '@altstack/ui/emails/magic-link'

export async function sendMagicLinkEmail({
	email,
	url,
}: {
	email: string
	url: string
}) {
	if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
		throw new APIError('SERVICE_UNAVAILABLE', {
			message:
				'Email sign-in is temporarily unavailable. Please try GitHub or try again later.',
		})
	}
	try {
		const template = createElement(MagicLinkEmail, {
			url,
			appUrl: env.EMAIL_APP_URL ?? env.CORS_ORIGINS[0]!,
		})
		const html = await render(template)
		const text = await render(template, { plainText: true })
		const { error } = await new Resend(env.RESEND_API_KEY).emails.send({
			from: `AltStack <${env.RESEND_FROM_EMAIL}>`,
			to: email,
			subject: 'Sign in to AltStack',
			html,
			text,
		})
		if (error) throw new Error('Email provider rejected the request')
	} catch {
		// Provider responses can contain recipient details. Never expose or log
		// them, the API key, or the token-bearing URL.
		throw new APIError('SERVICE_UNAVAILABLE', {
			message:
				'Unable to send a sign-in email. Please try again later or continue with GitHub.',
		})
	}
}
