import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'

interface SentMail {
	to: Array<string> | string
	html: string
	text: string
}

// Test-only HTTP sink. Email URLs stay in memory and never enter logs or files.
export async function createMagicLinkMailbox({ preview = false } = {}) {
	const messages: Array<SentMail> = []
	function linkFor(email: string) {
		const message = messages.findLast((mail) =>
			Array.isArray(mail.to) ? mail.to.includes(email) : mail.to === email
		)
		assert.ok(message, 'Mock email should be delivered')
		assert.ok(message.text.includes('10 minutes'))
		const href = /href="([^"]*\/api\/auth\/magic-link\/verify\?[^"]+)"/.exec(
			message.html
		)?.[1]
		assert.ok(
			href,
			'Mock email should include the Better Auth verification endpoint'
		)
		return href.replaceAll('&amp;', '&')
	}
	const receive = async (
		request: IncomingMessage,
		response: ServerResponse
	) => {
		if (preview && request.method === 'GET') {
			// Browser QA redeems synthetic mail without exposing tokens in tool
			// output. localhost keeps the same host-only cookie scope as the app.
			const url = new URL(request.url!, 'http://localhost')
			assert.equal(url.pathname, '/redeem')
			const verification = await fetch(
				linkFor(url.searchParams.get('email')!),
				{ redirect: 'manual' }
			)
			response.writeHead(verification.status, {
				location: verification.headers.get('location')!,
				'set-cookie': verification.headers.getSetCookie(),
				'cache-control': 'no-store',
			})
			response.end()
			return
		}
		assert.equal(request.method, 'POST')
		const chunks: Array<Buffer> = []
		for await (const chunk of request) {
			chunks.push(Buffer.from(chunk as Uint8Array))
		}
		messages.push(JSON.parse(Buffer.concat(chunks).toString()) as SentMail)
		response.writeHead(200, { 'content-type': 'application/json' })
		response.end(JSON.stringify({ id: crypto.randomUUID() }))
	}
	const server = createServer((request, response) => {
		void receive(request, response).catch(() => {
			response.writeHead(500)
			response.end()
		})
	})
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
	const address = server.address()
	assert.ok(address && typeof address !== 'string')
	return {
		previewURL: `http://localhost:${address.port}`,
		env: {
			ALTSTACK_TEST_MAILBOX_URL: `http://127.0.0.1:${address.port}`,
			RESEND_API_KEY: 're_synthetic-test-key-no-live-email',
			RESEND_FROM_EMAIL: 'sign-in@example.test',
		},
		messages,
		linkFor,
		async signIn(api: URL, web: URL, email: string, name: string) {
			const request = await fetch(
				new URL('/api/auth/sign-in/magic-link', api),
				{
					method: 'POST',
					headers: { 'content-type': 'application/json', origin: web.origin },
					body: JSON.stringify({
						email,
						name,
						callbackURL: new URL('/submit', web).href,
					}),
				}
			)
			assert.equal(request.status, 200)
			const verification = await fetch(this.linkFor(email), {
				redirect: 'manual',
			})
			assert.equal(verification.status, 302)
			const cookie = verification.headers
				.getSetCookie()
				.map((value) => value.split(';')[0])
				.join('; ')
			const identity = await fetch(new URL('/api/auth/get-session', api), {
				headers: { cookie },
			})
			const data = (await identity.json()) as { user: { id: string } }
			assert.ok(data.user.id)
			return { id: data.user.id, email, cookie }
		},
		close: () =>
			new Promise<void>((resolve, reject) =>
				server.close((error) => (error ? reject(error) : resolve()))
			),
	}
}
