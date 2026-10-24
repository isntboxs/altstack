import type { ClaimGithubEvidence } from '@altstack/shared/schemas/ownership'

import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@altstack/ui/components/alert'

export function ClaimGithubEvidenceView({
	evidence,
}: {
	evidence: ClaimGithubEvidence | null
}) {
	const status = evidence?.status
	return (
		<Alert
			variant={status === 'denied' ? 'destructive' : 'default'}
			data-github-status={status ?? 'unchecked'}
		>
			<AlertTitle>GitHub access</AlertTitle>
			<AlertDescription>
				{!evidence
					? 'GitHub access has not been checked. It will be checked before approval.'
					: status === 'disconnected'
						? 'Connect your GitHub account before requesting project access. Use the same verified email as your AltStack account.'
						: status === 'denied'
							? evidence.reason === 'insufficient_access'
								? 'This GitHub account does not have write or maintainer access to the project repository.'
								: 'The GitHub account or repository identity changed. Reconnect GitHub or ask an admin to check the listing.'
							: status === 'verified'
								? `${evidence.login ?? 'Your GitHub account'} has ${evidence.permission} access. Independent project approval is still required.`
								: status === 'limited'
									? `${evidence.login ?? 'Your GitHub account'} has write access. A reviewer must independently confirm that you represent the project.`
									: 'GitHub could not confirm repository access. Reconnect or retry. A reviewer can consider independent evidence manually.'}
				{evidence?.login && (
					<a
						href={`https://github.com/${encodeURIComponent(evidence.login)}`}
						target="_blank"
						rel="noreferrer"
						className="underline underline-offset-4"
					>
						View @{evidence.login} on GitHub
					</a>
				)}
			</AlertDescription>
		</Alert>
	)
}
