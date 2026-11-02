import { EmailLayout } from '@altstack/ui/emails/layout'
import { EmailAction, EmailText } from '@altstack/ui/emails/primitives'

export function AdCampaignEmail({
	appUrl,
	plan,
	message,
	manageUrl,
	privateLink = true,
}: {
	appUrl: string
	plan: string
	message: string
	manageUrl: string
	privateLink?: boolean
}) {
	return (
		<EmailLayout
			appUrl={appUrl}
			preview={message}
			eyebrow="ADVERTISING"
			title={`${plan} campaign update`}
		>
			<EmailText>{message}</EmailText>
			<EmailAction href={manageUrl}>Manage campaign</EmailAction>
			{privateLink && (
				<EmailText>
					This private link is valid for 24 hours from creation. Request a new
					link from the advertising page whenever you need access. Keep this
					email private.
				</EmailText>
			)}
		</EmailLayout>
	)
}
