import { EmailLayout } from '@altstack/ui/emails/layout'
import type { EmailBrandProps } from '@altstack/ui/emails/layout'
import {
	EmailAction,
	EmailLink,
	EmailText,
} from '@altstack/ui/emails/primitives'

interface MagicLinkEmailProps extends EmailBrandProps {
	url: string
}

export function MagicLinkEmail({ url, appUrl }: MagicLinkEmailProps) {
	return (
		<EmailLayout
			appUrl={appUrl}
			preview="Your AltStack sign-in link. Expires in 10 minutes."
			eyebrow="YOUR ACCOUNT"
			title="Sign in to AltStack"
		>
			<EmailText>
				Join the open source community. Use this link to securely sign in to
				your account.
			</EmailText>
			<EmailAction href={url}>Sign in to AltStack</EmailAction>
			<EmailText>
				This link expires in 10 minutes and can only be used once. Do not
				forward or share it.
			</EmailText>
			<EmailText>
				If the button does not work,{' '}
				<EmailLink href={url}>open your sign-in link</EmailLink>.
			</EmailText>
			<EmailText>
				If you did not request this email, you can safely ignore it.
			</EmailText>
		</EmailLayout>
	)
}

MagicLinkEmail.PreviewProps = {
	appUrl: 'https://altstack.example',
	url: 'https://api.altstack.example/sign-in-preview',
} satisfies MagicLinkEmailProps
