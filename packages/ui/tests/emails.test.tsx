import { render } from '@react-email/render'
import { describe, expect, it } from 'vite-plus/test'

import { MagicLinkEmail } from '@altstack/ui/emails/magic-link'
import { SubmissionPublishedEmail } from '@altstack/ui/emails/submission-published'
import { SubmissionRejectedEmail } from '@altstack/ui/emails/submission-rejected'

const appUrl = 'https://altstack.example'
const submissionUrl = `${appUrl}/submission`
const name = 'Canvas <script>alert(1)</script> & Tools'
const reason =
	'Add a README.\n<img src="x" onerror="steal()"> & verify the demo.'

describe('shared transactional email templates', () => {
	it.each([
		[
			'magic-link',
			<MagicLinkEmail
				key="magic-link"
				appUrl={appUrl}
				url="https://api.altstack.example/sign-in-preview"
			/>,
			[
				'10 minutes',
				'only be used once',
				'https://api.altstack.example/sign-in-preview',
			],
		],
		[
			'published',
			<SubmissionPublishedEmail
				key="published"
				appUrl={appUrl}
				projectName={name}
				projectUrl={`${appUrl}/canvas`}
				submissionUrl={submissionUrl}
			/>,
			[name, submissionUrl, `${appUrl}/canvas`],
		],
		[
			'rejected',
			<SubmissionRejectedEmail
				key="rejected"
				appUrl={appUrl}
				projectName={name}
				rejectionReason={reason}
				submissionUrl={submissionUrl}
			/>,
			[
				name,
				submissionUrl,
				'Edit & Resubmit',
				'Add a README.',
				'<img src="x" onerror="steal()">',
			],
		],
	] as const)(
		'renders %s with accessible brand fallback, escaped content, absolute links and useful text',
		async (_variant, email, expectedText) => {
			const html = await render(email)
			const text = await render(email, { plainText: true })
			expect(html).toContain('lang="en"')
			expect(html.match(/<h1\b/g)).toHaveLength(1)
			expect(html).toContain('alt=""')
			expect(html).toContain(`${appUrl}/brand/altstack-email-symbol.png`)
			expect(html).toContain('altstack</p>') // Visible even with external images blocked.
			expect(html).not.toContain('<script>')
			expect(html).not.toContain('onerror="steal()"')
			expect(html).not.toMatch(/display:\s*(flex|grid)|<svg\b/)
			expect(Buffer.byteLength(html)).toBeLessThan(102_000)
			for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
				expect(match[1]).toMatch(/^https:\/\//)
			}
			for (const value of expectedText) {
				expect(text).toContain(value)
			}
		}
	)
	it.each([
		'javascript:alert(1)',
		'/relative',
		'//evil.example',
		'https://user:pass@evil.example',
	])('refuses unsafe URL %s', async (url) => {
		await expect(
			render(<MagicLinkEmail appUrl={appUrl} url={url} />)
		).rejects.toThrow(/Invalid URL|Email links must/)
	})
	it('keeps long untrusted feedback as text rather than interpreting links or markup', async () => {
		const html = await render(
			<SubmissionRejectedEmail
				appUrl={appUrl}
				projectName={'A'.repeat(100)}
				rejectionReason={'<b>javascript:evil()</b>\n'.repeat(40)}
				submissionUrl={submissionUrl}
			/>
		)
		expect(html).toContain('&lt;b&gt;')
		expect(html).not.toContain('<b>javascript:evil()')
		expect(html).not.toContain('href="javascript:')
	})
})
