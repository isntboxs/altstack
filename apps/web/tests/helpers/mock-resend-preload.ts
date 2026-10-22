// Loaded explicitly by acceptance runners, never imported by application code.
// Even production-mode SSR QA is confined to a disposable local test schema.
const database = new URL(process.env.DATABASE_URL!)
if (
	database.hostname !== 'localhost' ||
	database.pathname !== '/altstack_test' ||
	!/^.*search_path=altstack_test_[a-f0-9]{32}(?:,|$)/.test(
		database.searchParams.get('options') ?? ''
	)
) {
	throw new Error(
		'Mock email transport requires a disposable local test schema'
	)
}
const mailbox = new URL(process.env.ALTSTACK_TEST_MAILBOX_URL!)
if (mailbox.protocol !== 'http:' || mailbox.hostname !== '127.0.0.1') {
	throw new Error('Mock mailbox must be loopback')
}
const originalFetch = globalThis.fetch
const mockFetch: typeof globalThis.fetch = Object.assign(
	async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init)
		if (new URL(request.url).hostname !== 'api.resend.com') {
			return originalFetch(input, init)
		}
		if (
			new URL(request.url).pathname !== '/emails' ||
			request.method !== 'POST'
		) {
			throw new Error('Unexpected mocked Resend operation')
		}
		return originalFetch(mailbox, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: await request.text(),
		})
	},
	{ preconnect: originalFetch.preconnect }
)
globalThis.fetch = mockFetch
