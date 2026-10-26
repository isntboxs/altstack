import { betterAuth } from 'better-auth'
import { memoryAdapter } from 'better-auth/adapters/memory'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { createAuthConfig } from '@altstack/auth/server/config'

const { env, sendEmail } = vi.hoisted(() => {
	return {
		env: {
			APP_NAME: 'AltStack test',
			BETTER_AUTH_URL: 'https://api.example.test',
			BETTER_AUTH_SECRET: 'synthetic-test-secret-at-least-32-characters',
			BETTER_AUTH_COOKIE_DOMAIN: undefined as string | undefined,
			CORS_ORIGINS: ['https://app.example.test'],
			GITHUB_CLIENT_ID: 'synthetic-client',
			GITHUB_CLIENT_SECRET: 'synthetic-github-secret-at-least-32-characters',
		},
		sendEmail: vi.fn<(data: { email: string; url: string }) => Promise<void>>(),
	}
})
vi.mock('@altstack/env/server', () => {
	return { env }
})
vi.mock('@altstack/db', () => {
	return { db: {} }
})
vi.mock('../src/server/magic-link-email', () => {
	return {
		sendMagicLinkEmail: sendEmail,
	}
})
// Recipient quota uses PostgreSQL; the real storage/concurrency behavior is
// covered in magic-link-postgres.test.ts. This suite isolates the memory adapter.
vi.mock('../src/server/magic-link-rate-limit', () => {
	return {
		MAGIC_LINK_RATE_LIMIT: { window: 600, max: 5 },
		createMagicLinkRecipientLimiter: () => () => Promise.resolve(),
	}
})

beforeEach(() => {
	env.BETTER_AUTH_URL = 'https://api.example.test'
	env.BETTER_AUTH_COOKIE_DOMAIN = undefined
	env.CORS_ORIGINS = ['https://app.example.test']
	sendEmail.mockReset().mockResolvedValue(undefined)
})

afterEach(() => vi.unstubAllGlobals())

function createTestAuth() {
	const store = {
		user: [] as Array<Record<string, unknown>>,
		session: [] as Array<Record<string, unknown>>,
		account: [] as Array<Record<string, unknown>>,
		verification: [] as Array<Record<string, unknown>>,
		rateLimit: [] as Array<Record<string, unknown>>,
	}
	const config = createAuthConfig()
	const auth = betterAuth({
		...config,
		advanced: {
			...config.advanced,
			disableOriginCheck: false,
			disableCSRFCheck: false,
		},
		database: memoryAdapter(store),
	})
	async function post(
		path: string,
		body: unknown,
		origin = env.CORS_ORIGINS[0]!,
		headers: Record<string, string> = {}
	) {
		return auth.handler(
			new Request(`${env.BETTER_AUTH_URL}/api/auth${path}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json', origin, ...headers },
				body: JSON.stringify(body),
			})
		)
	}
	async function requestLink(
		body: Record<string, unknown> = {},
		origin?: string
	) {
		const response = await post(
			'/sign-in/magic-link',
			{
				email: 'synthetic@example.test',
				callbackURL: `${env.CORS_ORIGINS[0]}/submit?from=auth`,
				errorCallbackURL: `${env.CORS_ORIGINS[0]}/auth/sign-in?returnTo=%2Fsubmit`,
				...body,
			},
			origin
		)
		return response
	}
	function verify(url = sendEmail.mock.calls.at(-1)![0].url) {
		return auth.handler(new Request(url))
	}
	return { auth, store, post, requestLink, verify }
}

async function signIn() {
	const test = createTestAuth()
	expect((await test.requestLink()).status).toBe(200)
	return test.verify()
}

it('rejects a session that survives a ban race and clears its cookies on session reads', async () => {
	const test = createTestAuth()
	await test.requestLink()
	const signedIn = await test.verify()
	const cookie = signedIn.headers
		.getSetCookie()
		.map((value) => value.split(';')[0])
		.join('; ')
	test.store.user[0]!.banned = true
	test.store.user[0]!.banExpires = null
	const response = await test.auth.handler(
		new Request(`${env.BETTER_AUTH_URL}/api/auth/get-session`, {
			headers: { cookie },
		})
	)
	expect(response.status).toBe(200)
	expect(await response.json()).toBeNull()
	expect(test.store.session).toHaveLength(0)
	expect(
		response.headers
			.getSetCookie()
			.some((value) => value.includes('session_token=;'))
	).toBe(true)
})
function sessionCookie(response: Response) {
	return response.headers
		.getSetCookie()
		.map((value) => value.split(';')[0])
		.join('; ')
}

describe('auth cookie scope', () => {
	it('retains GitHub OAuth and applies the explicitly configured shared cookie domain', async () => {
		env.BETTER_AUTH_COOKIE_DOMAIN = 'example.test'
		const response = await createTestAuth().post('/sign-in/social', {
			provider: 'github',
			callbackURL: 'https://app.example.test/',
			disableRedirect: true,
		})
		expect(response.status).toBe(200)
		const { url } = (await response.json()) as { url: string }
		expect(new URL(url).hostname).toBe('github.com')
		expect(response.headers.getSetCookie().length).toBeGreaterThan(0)
		for (const cookie of response.headers.getSetCookie()) {
			for (const attribute of [
				'Domain=example.test',
				'HttpOnly',
				'Secure',
				'SameSite=Lax',
			]) {
				expect(cookie).toContain(attribute)
			}
		}
	})
	it('issues secure shared session cookies through Magic Link verification', async () => {
		env.BETTER_AUTH_COOKIE_DOMAIN = 'example.test'
		const response = await signIn()
		expect(response.status).toBe(302)
		const cookie = response.headers
			.getSetCookie()
			.find((value) => value.startsWith('__Secure-better-auth.session_token='))
		expect(cookie).toBeDefined()
		for (const attribute of [
			'Domain=example.test',
			'Path=/',
			'HttpOnly',
			'Secure',
			'SameSite=Lax',
		]) {
			expect(cookie).toContain(attribute)
		}
	})
	it('keeps HTTPS cookies host-only when the parent domain is unset', async () => {
		const response = await signIn()
		expect(response.headers.getSetCookie().length).toBeGreaterThan(0)
		for (const cookie of response.headers.getSetCookie()) {
			expect(cookie).not.toMatch(/;\s*domain=/i)
		}
	})
	it('keeps localhost cookies host-only and usable over HTTP', async () => {
		env.BETTER_AUTH_URL = 'http://localhost:3009'
		env.CORS_ORIGINS = ['http://localhost:3010']
		const response = await signIn()
		const cookie = response.headers
			.getSetCookie()
			.find((value) => value.startsWith('better-auth.session_token='))
		expect(cookie).toContain('HttpOnly')
		expect(cookie).toContain('SameSite=Lax')
		expect(cookie).not.toMatch(/;\s*(domain=|secure)/i)
	})
	it('rejects untrusted origins before sending mail', async () => {
		env.BETTER_AUTH_COOKIE_DOMAIN = 'example.test'
		const response = await createTestAuth().requestLink(
			{},
			'https://untrusted.example.test'
		)
		expect(response.status).toBe(403)
		expect(response.headers.getSetCookie()).toHaveLength(0)
		expect(sendEmail).not.toHaveBeenCalled()
	})
})

describe('supported authentication methods', () => {
	it.each(['/sign-in/email', '/sign-in/username'])(
		'rejects a valid legacy credential at %s without creating a session',
		async (path) => {
			const test = createTestAuth()
			const context = await test.auth.$context
			const password = 'synthetic-legacy-password'
			const user = await context.internalAdapter.createUser(
				{
					email: 'synthetic@example.test',
					name: 'Legacy user',
					emailVerified: true,
				},
				{ method: 'email' }
			)
			// Preserve the real legacy username column even after its plugin is removed.
			test.store.user[0]!.username = 'synthetic'
			const hash = await context.password.hash(password)
			await context.internalAdapter.createAccount({
				userId: user.id,
				providerId: 'credential',
				accountId: user.id,
				password: hash,
			})
			expect(await context.password.verify({ hash, password })).toBe(true)
			const response = await test.post(path, {
				email: user.email,
				username: 'synthetic',
				password,
			})
			expect(response.ok).toBe(false)
			expect(response.status).toBe(path === '/sign-in/username' ? 404 : 400)
			expect(response.headers.getSetCookie()).toHaveLength(0)
			expect(test.store.session).toHaveLength(0)
			expect(test.store.account).toHaveLength(1)
			expect(sendEmail).not.toHaveBeenCalled()
		}
	)
	it.each(['/sign-in/email', '/sign-up/email', '/sign-in/username'])(
		'rejects password authentication at %s on the server',
		async (path) => {
			const response = await createTestAuth().post(path, {
				email: 'synthetic@example.test',
				password: 'synthetic-password',
				name: 'Synthetic',
				username: 'synthetic',
			})
			expect(response.ok).toBe(false)
			expect(response.headers.getSetCookie()).toHaveLength(0)
			expect(sendEmail).not.toHaveBeenCalled()
		}
	)
	it('creates no user or session until inbox verification, then establishes a real HTTP session', async () => {
		const test = createTestAuth()
		const response = await test.requestLink({
			email: 'SYNTHETIC@EXAMPLE.TEST',
			role: 'admin',
		})
		expect(response.status).toBe(200)
		expect(await response.json()).toEqual({ status: true })
		expect(response.headers.getSetCookie()).toHaveLength(0)
		expect(test.store.user).toHaveLength(0)
		expect(test.store.session).toHaveLength(0)
		expect(sendEmail.mock.calls[0]![0].email).toBe('synthetic@example.test')
		const url = new URL(sendEmail.mock.calls[0]![0].url)
		expect(url.origin).toBe(env.BETTER_AUTH_URL)
		expect(url.pathname).toBe('/api/auth/magic-link/verify')
		const token = url.searchParams.get('token')!
		expect(JSON.stringify(test.store.verification)).not.toContain(token)
		const expiresAt = test.store.verification[0]!.expiresAt as Date
		expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(590_000)
		const verified = await test.verify()
		expect(verified.status).toBe(302)
		expect(verified.headers.get('location')).toBe(
			'https://app.example.test/submit?from=auth'
		)
		const session = await test.auth.handler(
			new Request(`${env.BETTER_AUTH_URL}/api/auth/get-session`, {
				headers: { cookie: sessionCookie(verified) },
			})
		)
		const data = (await session.json()) as {
			user: { email: string; emailVerified: boolean; role: string }
			session: unknown
		}
		expect(data.user.email).toBe('synthetic@example.test')
		expect(data.user.emailVerified).toBe(true)
		expect(data.user.role).toBe('user')
		expect(data.session).toBeTruthy()
		expect(test.store.account).toHaveLength(0)
	})
	it.each([
		'',
		'not-an-email',
		'a@b',
		'x\r\nBcc: other@example.test',
		`${'a'.repeat(245)}@example.test`,
	])('rejects invalid email input %s without sending', async (email) => {
		const response = await createTestAuth().requestLink({ email })
		expect(response.status).toBe(400)
		expect(sendEmail).not.toHaveBeenCalled()
	})
	it.each(['callbackURL', 'newUserCallbackURL', 'errorCallbackURL'])(
		'rejects an untrusted %s before delivery',
		async (field) => {
			const response = await createTestAuth().requestLink({
				[field]: 'https://evil.example/phish',
			})
			expect(response.status).toBe(403)
			expect(sendEmail).not.toHaveBeenCalled()
		}
	)
	it('does not trust client Host or Origin for the email verification endpoint', async () => {
		const test = createTestAuth()
		const response = await test.post(
			'/sign-in/magic-link',
			{ email: 'synthetic@example.test' },
			env.CORS_ORIGINS[0],
			{ host: 'evil.example', 'x-forwarded-host': 'evil.example' }
		)
		expect(response.status).toBe(200)
		expect(new URL(sendEmail.mock.calls[0]![0].url).origin).toBe(
			env.BETTER_AUTH_URL
		)
	})
	it('persists the built-in mail rate limit across auth instances sharing storage', async () => {
		const test = createTestAuth()
		const responses: Array<Response> = []
		for (let attempt = 0; attempt < 7; attempt++) {
			responses.push(await test.requestLink())
		}
		expect(
			responses.filter((response) => response.status === 200)
		).toHaveLength(5)
		expect(
			responses.filter((response) => response.status === 429)
		).toHaveLength(2)
		expect(sendEmail).toHaveBeenCalledTimes(5)
		expect(
			responses
				.find((response) => response.status === 429)
				?.headers.get('X-Retry-After')
		).toBeTruthy()
		const config = createAuthConfig()
		const restarted = betterAuth({
			...config,
			database: memoryAdapter(test.store),
		})
		const response = await restarted.handler(
			new Request(`${env.BETTER_AUTH_URL}/api/auth/sign-in/magic-link`, {
				method: 'POST',
				headers: {
					origin: env.CORS_ORIGINS[0]!,
					'content-type': 'application/json',
				},
				body: JSON.stringify({ email: 'another@example.test' }),
			})
		)
		expect(response.status).toBe(429)
		expect(sendEmail).toHaveBeenCalledTimes(5)
	})
})

describe('Magic Link verification and account privacy', () => {
	it.each(['wrong', 'expired', 'reused'])(
		'rejects %s links without establishing a session',
		async (kind) => {
			const test = createTestAuth()
			await test.requestLink()
			const url = new URL(sendEmail.mock.calls[0]![0].url)
			if (kind === 'wrong') url.searchParams.set('token', 'incorrect-token')
			if (kind === 'expired') {
				test.store.verification[0]!.expiresAt = new Date(Date.now() - 1000)
			}
			if (kind === 'reused') await test.verify(url.href)
			const response = await test.verify(url.href)
			expect(response.status).toBe(302)
			const destination = new URL(response.headers.get('location')!)
			expect(destination.origin).toBe('https://app.example.test')
			expect(destination.pathname).toBe('/auth/sign-in')
			expect(destination.searchParams.get('returnTo')).toBe('/submit')
			expect(destination.searchParams.get('error')).toBe('INVALID_TOKEN')
			expect(response.headers.getSetCookie()).toHaveLength(0)
		}
	)
	it('allows exactly one concurrent redemption', async () => {
		const test = createTestAuth()
		await test.requestLink()
		const responses = await Promise.all([test.verify(), test.verify()])
		expect(
			responses.filter((response) => response.headers.getSetCookie().length > 0)
		).toHaveLength(1)
		expect(test.store.session).toHaveLength(1)
	})
	it('rejects tampered verification callbacks before consuming the token', async () => {
		const test = createTestAuth()
		await test.requestLink()
		const url = new URL(sendEmail.mock.calls[0]![0].url)
		url.searchParams.set('callbackURL', 'https://evil.example')
		expect((await test.verify(url.href)).status).toBe(403)
		expect(test.store.session).toHaveLength(0)
		expect((await test.verify()).headers.getSetCookie().length).toBeGreaterThan(
			0
		)
	})
	it('reuses an existing verified GitHub user without changing role, profile, or provider association', async () => {
		const test = createTestAuth()
		const context = await test.auth.$context
		const user = await context.internalAdapter.createUser(
			{
				email: 'synthetic@example.test',
				name: 'Existing admin',
				emailVerified: true,
				role: 'admin',
			},
			{ method: 'magic-link' }
		)
		const account = await context.internalAdapter.createAccount({
			userId: user.id,
			providerId: 'github',
			accountId: 'synthetic-github-id',
		})
		await test.requestLink({ name: 'Untrusted replacement', role: 'user' })
		const response = await test.verify()
		expect(response.headers.getSetCookie().length).toBeGreaterThan(0)
		expect(test.store.user).toHaveLength(1)
		expect(test.store.user[0]).toMatchObject({
			id: user.id,
			name: 'Existing admin',
			role: 'admin',
		})
		expect(test.store.account).toEqual([
			expect.objectContaining({
				id: account.id,
				providerId: 'github',
				userId: user.id,
			}),
		])
	})
	it('uses the framework takeover defense for a pre-created, unverified account', async () => {
		const test = createTestAuth()
		const context = await test.auth.$context
		const user = await context.internalAdapter.createUser(
			{
				email: 'synthetic@example.test',
				name: 'Unverified',
				emailVerified: false,
			},
			{ method: 'magic-link' }
		)
		await context.internalAdapter.createAccount({
			userId: user.id,
			providerId: 'credential',
			accountId: user.id,
			password: 'synthetic-unproven-hash',
		})
		await context.internalAdapter.createSession(user.id)
		await test.requestLink()
		await test.verify()
		expect(test.store.user).toHaveLength(1)
		expect(test.store.user[0]!.emailVerified).toBe(true)
		expect(test.store.account).toHaveLength(0)
		expect(test.store.session).toHaveLength(1)
	})
	it('returns the same request response for existing and new mailboxes without exposing account data', async () => {
		const test = createTestAuth()
		const context = await test.auth.$context
		await context.internalAdapter.createUser(
			{
				email: 'synthetic@example.test',
				name: 'Private admin',
				emailVerified: true,
				role: 'admin',
			},
			{ method: 'magic-link' }
		)
		const existing = await test.requestLink()
		const fresh = await test.requestLink({ email: 'fresh@example.test' })
		expect(existing.status).toBe(fresh.status)
		expect(await existing.json()).toEqual(await fresh.json())
		expect(await test.post('/list-accounts', {})).toHaveProperty('status', 404)
	})
})

describe('GitHub account linking after email verification', () => {
	it.each([true, false])(
		'requires the provider email verification proof (%s)',
		async (verified) => {
			vi.stubGlobal(
				'fetch',
				vi.fn((input: RequestInfo | URL) => {
					const url = new URL(
						input instanceof Request ? input.url : input.toString()
					)
					const body =
						url.pathname === '/login/oauth/access_token'
							? {
									access_token: 'synthetic-oauth-access',
									token_type: 'bearer',
									scope: 'read:user user:email',
								}
							: url.pathname === '/user/emails'
								? [{ email: 'synthetic@example.test', primary: true, verified }]
								: {
										id: 'linked-github-identity',
										email: 'synthetic@example.test',
										name: 'Provider name',
										login: 'synthetic',
									}
					return Promise.resolve(
						new Response(JSON.stringify(body), {
							headers: { 'content-type': 'application/json' },
						})
					)
				})
			)
			const test = createTestAuth()
			const context = await test.auth.$context
			const user = await context.internalAdapter.createUser(
				{
					email: 'synthetic@example.test',
					emailVerified: true,
					name: 'Inbox owner',
					role: 'admin',
				},
				{ method: 'magic-link' }
			)
			const start = await test.post('/sign-in/social', {
				provider: 'github',
				callbackURL: 'https://app.example.test/submit',
				disableRedirect: true,
			})
			expect(start.status).toBe(200)
			const authorization = (await start.json()) as { url: string }
			const callback = new URL('/api/auth/callback/github', env.BETTER_AUTH_URL)
			callback.searchParams.set('code', 'synthetic-code')
			callback.searchParams.set(
				'state',
				new URL(authorization.url).searchParams.get('state')!
			)
			const response = await test.auth.handler(
				new Request(callback, { headers: { cookie: sessionCookie(start) } })
			)
			expect(response.status).toBe(302)
			expect(test.store.user).toHaveLength(1)
			expect(test.store.user[0]).toMatchObject({
				id: user.id,
				name: 'Inbox owner',
				role: 'admin',
			})
			expect(test.store.account).toHaveLength(verified ? 1 : 0)
			expect(test.store.session).toHaveLength(verified ? 1 : 0)
		}
	)
})
