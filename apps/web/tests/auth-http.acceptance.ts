import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

import { createMagicLinkMailbox } from './helpers/magic-link-mailbox.ts'

// Only test:scoped may supply this process's database and own its cleanup.
assert.equal(process.env.NODE_ENV, 'test')
assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/altstack_test')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const schema = await pool.query<{ name: string; schema: string }>(
	'SELECT current_database() AS name, current_schema() AS schema'
)
assert.equal(schema.rows[0].name, 'altstack_test')
assert.match(schema.rows[0].schema, /^altstack_test_[a-f0-9]{32}$/)

const workspace = fileURLToPath(new URL('../../../', import.meta.url))
const web = new URL(process.env.VITE_APP_URL!)
const api = new URL(process.env.VITE_SERVER_URL!)
for (const url of [web, api]) {
	assert.equal(url.protocol, 'http:')
	assert.equal(url.hostname, 'localhost')
	assert.ok(url.port)
}
assert.notEqual(web.port, api.port)
const evidence = await mkdtemp(join(tmpdir(), 'altstack-auth-http-'))
const children: Array<ReturnType<typeof spawn>> = []
const email = `auth-${crypto.randomUUID()}@example.test`
const mailbox = await createMagicLinkMailbox()
const env = {
	...process.env,
	...mailbox.env,
	NODE_ENV: 'production',
	BETTER_AUTH_URL: api.origin,
	BETTER_AUTH_COOKIE_DOMAIN: '',
	CORS_ORIGINS: web.origin,
}

function start(
	command: string,
	args: Array<string>,
	name: string,
	port?: string
) {
	const log = createWriteStream(join(evidence, `${name}.log`), { mode: 0o600 })
	const child = spawn(command, args, {
		cwd: workspace,
		env: { ...env, ...(port ? { PORT: port, HOST: '127.0.0.1' } : {}) },
		stdio: ['ignore', 'pipe', 'pipe'],
		detached: true,
	})
	child.stdout.pipe(log)
	child.stderr.pipe(log)
	children.push(child)
	return child
}

async function ready(url: string, child: ReturnType<typeof spawn>) {
	for (let attempt = 0; attempt < 100; attempt++) {
		assert.equal(child.exitCode, null, `Process exited; logs: ${evidence}`)
		try {
			if ((await fetch(url)).ok) return
		} catch {
			// Cold startup.
		}
		await new Promise((resolve) => setTimeout(resolve, 200))
	}
	throw new Error(`Server did not start; logs: ${evidence}`)
}

async function page(path: string, cookie?: string) {
	return fetch(new URL(path, web), {
		redirect: 'manual',
		headers: cookie ? { cookie } : {},
	})
}

function redirectedToSignIn(response: Response) {
	assert.ok([302, 307].includes(response.status))
	const location = new URL(response.headers.get('location')!, web)
	assert.equal(location.pathname, '/auth/sign-in')
	assert.equal(location.searchParams.get('returnTo'), '/submit')
}

try {
	if (!process.argv.includes('--skip-build')) {
		const build = start('vp', ['run', '-r', 'build'], 'build')
		await once(build, 'exit')
		assert.equal(build.exitCode, 0, `Build failed; logs: ${evidence}`)
	}
	const server = start(
		'bun',
		[
			'run',
			'--preload',
			'./apps/web/tests/helpers/mock-resend-preload.ts',
			'apps/server/dist/index.mjs',
		],
		'api',
		api.port
	)
	await ready(new URL('/api/auth/ok', api).href, server)
	const client = start(
		'node',
		['apps/web/.output/server/index.mjs'],
		'web',
		web.port
	)
	await ready(new URL('/robots.txt', web).href, client)

	redirectedToSignIn(await page('/submit'))
	assert.match(await (await page('/')).text(), /Sign in/)

	for (const path of ['/sign-up/email', '/sign-in/email']) {
		const rejected = await fetch(new URL(`/api/auth${path}`, api), {
			method: 'POST',
			headers: { 'content-type': 'application/json', origin: web.origin },
			body: JSON.stringify({
				email,
				password: 'synthetic-local-test-password',
				name: 'Synthetic user',
			}),
		})
		assert.equal(rejected.ok, false)
		assert.equal(rejected.headers.getSetCookie().length, 0)
	}
	const requested = await fetch(new URL('/api/auth/sign-in/magic-link', api), {
		method: 'POST',
		headers: { 'content-type': 'application/json', origin: web.origin },
		body: JSON.stringify({
			email,
			callbackURL: new URL('/submit', web).href,
			errorCallbackURL: new URL('/auth/sign-in?returnTo=%2Fsubmit', web).href,
		}),
	})
	assert.equal(requested.status, 200)
	assert.deepEqual(await requested.json(), { status: true })
	assert.equal(requested.headers.getSetCookie().length, 0)
	assert.equal(
		(await pool.query('SELECT id FROM "user" WHERE email = $1', [email]))
			.rowCount,
		0
	)
	const verification = await fetch(mailbox.linkFor(email), {
		redirect: 'manual',
	})
	assert.equal(verification.status, 302)
	assert.equal(
		verification.headers.get('location'),
		new URL('/submit', web).href
	)
	assert.equal(verification.headers.get('referrer-policy'), 'no-referrer')
	assert.match(verification.headers.get('cache-control')!, /private, no-store/)
	const cookieHeaders = verification.headers.getSetCookie()
	assert.ok(cookieHeaders.length > 0)
	for (const value of cookieHeaders) assert.doesNotMatch(value, /;\s*domain=/i)
	const cookie = cookieHeaders.map((value) => value.split(';')[0]).join('; ')
	const reused = await fetch(mailbox.linkFor(email), { redirect: 'manual' })
	assert.equal(reused.headers.getSetCookie().length, 0)
	assert.equal(
		new URL(reused.headers.get('location')!).searchParams.get('error'),
		'INVALID_TOKEN'
	)
	const identityRow = await pool.query<{
		id: string
		email_verified: boolean
		role: string
	}>('SELECT id, email_verified, role FROM "user" WHERE email = $1', [email])
	assert.equal(identityRow.rows[0].email_verified, true)
	assert.equal(identityRow.rows[0].role, 'user')
	const identity = { user: { id: identityRow.rows[0].id } }

	const sessionResponse = await fetch(new URL('/api/auth/get-session', api), {
		headers: { cookie },
	})
	assert.equal(sessionResponse.status, 200)
	const auth = (await sessionResponse.json()) as {
		user: { id: string }
		session: unknown
	}
	assert.equal(auth.user.id, identity.user.id)
	assert.ok(auth.session)
	const home = await page('/', cookie)
	assert.equal(home.status, 200)
	assert.match(await home.text(), /aria-label="Open user menu"/)
	const submit = await page('/submit', cookie)
	assert.equal(submit.status, 200)
	assert.match(await submit.text(), /Submit your open source project/)

	// Force only this synthetic session into Better Auth's refresh window.
	await pool.query('UPDATE "session" SET expires_at = $1 WHERE user_id = $2', [
		new Date(Date.now() + 60 * 60 * 24 * 1000).toISOString(),
		identity.user.id,
	])
	const refreshed = await page('/submit', cookie)
	assert.equal(refreshed.status, 200)
	assert.ok(
		refreshed.headers
			.getSetCookie()
			.some(
				(value) =>
					value.startsWith('better-auth.session_token=') &&
					value.includes('HttpOnly')
			)
	)

	// Same verified mailbox preserves the existing GitHub association and admin.
	const adminEmail = `admin-${crypto.randomUUID()}@example.test`
	const adminId = crypto.randomUUID()
	await pool.query(
		'INSERT INTO "user" (id, name, email, email_verified, role) VALUES ($1, $2, $3, true, $4)',
		[adminId, 'Existing admin', adminEmail, 'admin']
	)
	await pool.query(
		'INSERT INTO account (id, user_id, provider_id, account_id, updated_at) VALUES ($1, $2, $3, $4, now())',
		[crypto.randomUUID(), adminId, 'github', 'synthetic-github']
	)
	const admin = await mailbox.signIn(
		api,
		web,
		adminEmail,
		'Untrusted profile replacement'
	)
	assert.equal(admin.id, adminId)
	assert.equal(
		(
			await pool.query<{ role: string }>(
				'SELECT role FROM "user" WHERE id = $1',
				[adminId]
			)
		).rows[0].role,
		'admin'
	)
	assert.equal(
		(
			await pool.query(
				'SELECT id FROM account WHERE user_id = $1 AND provider_id = $2',
				[adminId, 'github']
			)
		).rowCount,
		1
	)

	// Email ownership cleanup is provided by Better Auth, including legacy accounts.
	const unverifiedEmail = `unverified-${crypto.randomUUID()}@example.test`
	const unverifiedId = crypto.randomUUID()
	await pool.query(
		'INSERT INTO "user" (id, name, email, email_verified, role) VALUES ($1, $2, $3, false, $4)',
		[unverifiedId, 'Legacy', unverifiedEmail, 'user']
	)
	const promoted = await mailbox.signIn(api, web, unverifiedEmail, 'Legacy')
	assert.equal(promoted.id, unverifiedId)

	// Expired links fail without cookies; tokens never leave this process's memory.
	const expiredEmail = `expired-${crypto.randomUUID()}@example.test`
	const expiredRequest = await fetch(
		new URL('/api/auth/sign-in/magic-link', api),
		{
			method: 'POST',
			headers: { 'content-type': 'application/json', origin: web.origin },
			body: JSON.stringify({
				email: expiredEmail,
				callbackURL: web.href,
				errorCallbackURL: new URL('/auth/sign-in', web).href,
			}),
		}
	)
	assert.equal(expiredRequest.status, 200)
	// The app stores timestamp-without-timezone values as UTC. A fixed past
	// date avoids pg serializing the local test runner's UTC+7 offset.
	const expiredUpdate = await pool.query(
		"UPDATE verification SET expires_at = '2000-01-01' WHERE value::jsonb->>'email' = $1",
		[expiredEmail]
	)
	assert.equal(expiredUpdate.rowCount, 1)
	const expired = await fetch(mailbox.linkFor(expiredEmail), {
		redirect: 'manual',
	})
	assert.equal(expired.headers.getSetCookie().length, 0)
	assert.equal(
		new URL(expired.headers.get('location')!).searchParams.get('error'),
		'INVALID_TOKEN'
	)

	// Database uniqueness + atomic increments must limit concurrent requests.
	const limited = await Promise.all(
		Array.from({ length: 7 }, (_, index) =>
			fetch(new URL('/api/auth/sign-in/magic-link', api), {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					origin: web.origin,
					'x-forwarded-for': '192.0.2.44',
				},
				body: JSON.stringify({
					email: `limited-${index}@example.test`,
					callbackURL: web.href,
				}),
			})
		)
	)
	assert.equal(limited.filter((response) => response.status === 200).length, 5)
	assert.equal(limited.filter((response) => response.status === 429).length, 2)
	// Different client IPs must still share one normalized recipient quota.
	const recipientEmail = `recipient-${crypto.randomUUID()}@example.test`
	const deliveredBefore = mailbox.messages.length
	const recipientLimited = await Promise.all(
		Array.from({ length: 7 }, (_, index) =>
			fetch(new URL('/api/auth/sign-in/magic-link', api), {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					origin: web.origin,
					'x-forwarded-for': `198.51.100.${index + 1}`,
				},
				body: JSON.stringify({
					email: index % 2 ? recipientEmail.toUpperCase() : recipientEmail,
					callbackURL: web.href,
				}),
			})
		)
	)
	assert.equal(
		recipientLimited.filter((response) => response.status === 200).length,
		5
	)
	assert.equal(
		recipientLimited.filter((response) => response.status === 429).length,
		2
	)
	assert.equal(mailbox.messages.length - deliveredBefore, 5)
	const recipientDenied = recipientLimited.find(
		(response) => response.status === 429
	)!
	assert.deepEqual(
		await recipientDenied.json(),
		await limited.find((response) => response.status === 429)!.json()
	)
	assert.ok(Number(recipientDenied.headers.get('X-Retry-After')) > 0)
	assert.equal(recipientDenied.headers.getSetCookie().length, 0)
	const unauthorized = await page(
		'/auth/sign-in?error=INVALID_TOKEN&returnTo=%2Fsubmit'
	)
	assert.equal(unauthorized.status, 200)
	assert.match(
		await unauthorized.text(),
		/invalid, has expired, or has already been used/
	)
	const signedInReturn = await page('/auth/sign-in?returnTo=%2Fsubmit', cookie)
	assert.ok([302, 307].includes(signedInReturn.status))
	assert.equal(
		new URL(signedInReturn.headers.get('location')!, web).pathname,
		'/submit'
	)
	const safeReturn = await page(
		'/auth/sign-in?returnTo=https%3A%2F%2Fevil.example',
		cookie
	)
	assert.equal(
		new URL(safeReturn.headers.get('location')!, web).origin,
		web.origin
	)

	const signOut = await fetch(new URL('/api/auth/sign-out', api), {
		method: 'POST',
		headers: { cookie, origin: web.origin },
	})
	assert.equal(signOut.status, 200)
	redirectedToSignIn(await page('/submit', cookie))
	console.debug(
		'PASS: password rejection, mocked Resend delivery, Magic Link sessions/replay/expiry, existing accounts, concurrent IP/recipient rate limits, local callbacks, SSR header/private routes/refresh/sign-out; disposable schema only.'
	)
} finally {
	for (const child of children) {
		const stillRunning = () =>
			child.exitCode === null && child.signalCode === null
		if (!stillRunning() || !child.pid) {
			continue
		}
		const exited = once(child, 'exit')
		process.kill(-child.pid, 'SIGTERM')
		await Promise.race([
			exited,
			new Promise((resolve) => setTimeout(resolve, 4000)),
		])
		if (stillRunning()) {
			process.kill(-child.pid, 'SIGKILL')
			await exited
		}
	}
	await mailbox.close()
	await pool.end()
}
