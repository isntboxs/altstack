import { Fragment } from 'react'
import { Section, Text } from 'react-email'

import { EmailLayout } from '@altstack/ui/emails/layout'
import type { EmailBrandProps } from '@altstack/ui/emails/layout'
import {
	EmailAction,
	EmailLink,
	EmailText,
} from '@altstack/ui/emails/primitives'

interface SubmissionRejectedEmailProps extends EmailBrandProps {
	projectName: string
	rejectionReason: string
	submissionUrl: string
}

export function SubmissionRejectedEmail({
	appUrl,
	projectName,
	rejectionReason,
	submissionUrl,
}: SubmissionRejectedEmailProps) {
	return (
		<EmailLayout
			appUrl={appUrl}
			preview={`Review update for ${projectName}: changes are needed before publication.`}
			eyebrow="SUBMISSION · REJECTED"
			title="A few changes are needed."
		>
			<EmailText>
				We reviewed <strong className="text-black">{projectName}</strong>. This
				submission was rejected and has not been published. Please use the
				feedback below to prepare it for another review.
			</EmailText>
			<Section
				className="my-6 rounded-lg border border-solid border-[#e5e5e5] bg-[#f5f5f5] px-4 py-2"
				style={{ tableLayout: 'fixed' }}
			>
				<Text className="mb-2 text-xs font-semibold tracking-[1px] text-[#525252]">
					REVIEW FEEDBACK
				</Text>
				<Text
					className="mt-0 text-sm leading-6 text-[#171717]"
					style={{
						overflowWrap: 'anywhere',
						wordBreak: 'break-word',
					}}
				>
					{rejectionReason.split(/\r?\n/).map((line, index) => (
						<Fragment key={index}>
							{index > 0 && <br />}
							{line}
						</Fragment>
					))}
				</Text>
			</Section>
			<EmailAction href={submissionUrl}>Review &amp; resubmit</EmailAction>
			<EmailText>
				Open{' '}
				<EmailLink href={submissionUrl}>your private submissions</EmailLink>,
				find {projectName}, and choose <strong>Edit &amp; Resubmit</strong>.
				Update the details and submit it for another review.
			</EmailText>
			<EmailText>
				Sign in with the account you used to submit the project. Your feedback
				and corrections stay private.
			</EmailText>
		</EmailLayout>
	)
}

SubmissionRejectedEmail.PreviewProps = {
	appUrl: 'https://altstack.example',
	projectName: 'Open Canvas',
	rejectionReason:
		'Please add setup instructions to the README and a working website link so we can verify the project.',
	submissionUrl: 'https://altstack.example/submission',
} satisfies SubmissionRejectedEmailProps
