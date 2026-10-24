import { EmailLayout } from '@altstack/ui/emails/layout'
import { EmailText } from '@altstack/ui/emails/primitives'

export function ProjectClaimEmail({
	code,
	projectName,
	role,
	appUrl,
}: {
	code: string
	projectName: string
	role: 'owner' | 'maintainer'
	appUrl: string
}) {
	return (
		<EmailLayout
			appUrl={appUrl}
			preview="Confirm your project contact email. Expires in 10 minutes."
			eyebrow="PROJECT VERIFICATION"
			title={`Verify ${projectName}`}
		>
			<EmailText>
				Use this code to confirm your contact email for your {role} access
				request for {projectName}.
			</EmailText>
			<EmailText>
				<strong style={{ fontSize: 32, letterSpacing: 8 }}>{code}</strong>
			</EmailText>
			<EmailText>
				This code expires in 10 minutes and can be used once. Do not share it.
				Email confirmation does not grant access: an existing project
				representative, or AltStack admin for the first claim, must approve your
				request.
			</EmailText>
			<EmailText>
				If you did not request this code, ignore this email.
			</EmailText>
		</EmailLayout>
	)
}

ProjectClaimEmail.PreviewProps = {
	code: '123456',
	projectName: 'Example project',
	role: 'maintainer',
	appUrl: 'https://altstack.example',
} satisfies Parameters<typeof ProjectClaimEmail>[0]
