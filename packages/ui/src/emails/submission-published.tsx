import { EmailLayout } from '@altstack/ui/emails/layout'
import type { EmailBrandProps } from '@altstack/ui/emails/layout'
import {
	EmailAction,
	EmailLink,
	EmailText,
} from '@altstack/ui/emails/primitives'

interface SubmissionPublishedEmailProps extends EmailBrandProps {
	projectName: string
	projectUrl: string
	submissionUrl: string
}

export function SubmissionPublishedEmail({
	appUrl,
	projectName,
	projectUrl,
	submissionUrl,
}: SubmissionPublishedEmailProps) {
	return (
		<EmailLayout
			appUrl={appUrl}
			preview={`${projectName} has been published on AltStack.`}
			eyebrow="SUBMISSION · PUBLISHED"
			title="Your project is live."
		>
			<EmailText>
				Good news — <strong className="text-black">{projectName}</strong> has
				been reviewed and published on AltStack. Thank you for helping others
				discover open source alternatives.
			</EmailText>
			<EmailAction href={projectUrl}>View published project</EmailAction>
			<EmailText>
				You can now explore and share your{' '}
				<EmailLink href={projectUrl}>public project page</EmailLink>.
			</EmailText>
			<EmailText>
				Keep track of this decision in{' '}
				<EmailLink href={submissionUrl}>your private submissions</EmailLink>.
				Sign in with the account you used to submit the project.
			</EmailText>
		</EmailLayout>
	)
}

SubmissionPublishedEmail.PreviewProps = {
	appUrl: 'https://altstack.example',
	projectName: 'Open Canvas',
	projectUrl: 'https://altstack.example/open-canvas',
	submissionUrl: 'https://altstack.example/submission',
} satisfies SubmissionPublishedEmailProps
