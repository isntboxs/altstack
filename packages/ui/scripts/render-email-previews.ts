import { render } from '@react-email/render'
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'

import { MagicLinkEmail } from '@altstack/ui/emails/magic-link'
import { SubmissionPublishedEmail } from '@altstack/ui/emails/submission-published'
import { SubmissionRejectedEmail } from '@altstack/ui/emails/submission-rejected'

// Static, synthetic fixtures. No env, database, provider or magic-link token.
const output = new URL('../../../docs/email-previews/', import.meta.url)
const appUrl = 'http://localhost:4174'
const props = {
	appUrl,
	projectName: 'Open Canvas',
	submissionUrl: `${appUrl}/submission`,
}
const templates = [
	[
		'magic-link',
		createElement(MagicLinkEmail, {
			appUrl,
			url: 'https://api.altstack.example/sign-in-preview',
		}),
	],
	[
		'published',
		createElement(SubmissionPublishedEmail, {
			...props,
			projectUrl: `${appUrl}/open-canvas`,
		}),
	],
	[
		'rejected',
		createElement(SubmissionRejectedEmail, {
			...props,
			rejectionReason:
				'Please add setup instructions to the README and a working demo link.\nInclude the license so visitors can confirm how the project may be used.',
		}),
	],
] as const

await mkdir(new URL('brand/', output), { recursive: true })
await copyFile(
	new URL(
		'../../../apps/web/public/brand/altstack-email-symbol.png',
		import.meta.url
	),
	new URL('brand/altstack-email-symbol.png', output)
)
for (const [name, template] of templates) {
	await writeFile(
		new URL(`${name}.html`, output),
		await render(template, { pretty: true })
	)
	await writeFile(
		new URL(`${name}.txt`, output),
		await render(template, { plainText: true })
	)
}
// Keep generated review artifacts reproducible under the workspace formatter.
execFileSync(
	'vp',
	[
		'fmt',
		...templates.map(([name]) =>
			fileURLToPath(new URL(`${name}.html`, output))
		),
	],
	{ stdio: 'inherit' }
)
process.stdout.write(`Synthetic HTML/text previews: ${fileURLToPath(output)}\n`)
