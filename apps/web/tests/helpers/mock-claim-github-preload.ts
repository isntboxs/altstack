// Explicit acceptance-only preload. Reuse its strict disposable-schema and
// loopback-mailbox guards; application code never imports this module.
import './mock-resend-preload.ts'

const originalFetch = globalThis.fetch
function profile(token: string) {
	if (!token.startsWith('synthetic-claim-github-')) {
		throw new Error('Unexpected GitHub credential in fixture')
	}
	const value = JSON.parse(
		Buffer.from(
			token.slice('synthetic-claim-github-'.length),
			'base64url'
		).toString()
	) as { id: number; email: string }
	if (
		!Number.isSafeInteger(value.id) ||
		!value.email.endsWith('@example.test')
	) {
		throw new Error('Invalid GitHub fixture identity')
	}
	return value
}
globalThis.fetch = Object.assign(
	async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init)
		const url = new URL(request.url)
		if (
			url.hostname === 'github.com' &&
			url.pathname === '/login/oauth/access_token'
		) {
			const form = new URLSearchParams(await request.text())
			const code = form.get('code') ?? url.searchParams.get('code') ?? ''
			const token = 'synthetic-claim-github-' + code
			profile(token)
			return Response.json({
				access_token: token,
				token_type: 'bearer',
				scope: 'read:user,user:email',
			})
		}
		if (url.hostname !== 'api.github.com') return originalFetch(input, init)
		const identity = profile(
			(request.headers.get('authorization') ?? '').replace(/^Bearer /i, '')
		)
		if (url.pathname === '/user') {
			return Response.json({
				id: identity.id,
				login: `representative-${identity.id}`,
				email: identity.email,
				name: 'Fixture representative',
				avatar_url: null,
			})
		}
		if (url.pathname === '/user/emails') {
			return Response.json([
				{
					email: identity.email,
					primary: true,
					verified: true,
					visibility: 'private',
				},
			])
		}
		if (url.pathname.startsWith('/repos/altstack-test-fixtures/ownership-')) {
			return Response.json({
				id: 456,
				private: false,
				permissions: { admin: false, maintain: true, push: true, pull: true },
			})
		}
		throw new Error('Unexpected GitHub fixture request')
	},
	{ preconnect: originalFetch.preconnect }
)
