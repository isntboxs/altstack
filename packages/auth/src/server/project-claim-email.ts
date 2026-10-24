import { render } from '@react-email/render'
import { createElement } from 'react'
import { Resend } from 'resend'

import { env } from '@altstack/env/server'

import { ProjectClaimEmail } from '@altstack/ui/emails/project-claim'

export async function sendProjectClaimEmail(data: {
	email: string
	code: string
	projectName: string
	role: 'owner' | 'maintainer'
}) {
	if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
		throw new Error('Claim email unavailable')
	}
	try {
		const template = createElement(ProjectClaimEmail, {
			...data,
			appUrl: env.EMAIL_APP_URL ?? env.CORS_ORIGINS[0]!,
		})
		const html = await render(template)
		const text = await render(template, { plainText: true })
		const { error } = await new Resend(env.RESEND_API_KEY).emails.send({
			from: `AltStack <${env.RESEND_FROM_EMAIL}>`,
			to: data.email,
			subject: 'Confirm your project access request · AltStack',
			html,
			text,
		})
		if (error) throw new Error('Delivery rejected')
	} catch {
		// Never propagate provider details, recipient addresses or codes.
		throw new Error('Claim email unavailable')
	}
}
