import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

// Only test:scoped may supply this process's database and own its cleanup.
assert.equal(process.env.NODE_ENV, 'test')
assert.equal(
	new URL(process.env.DATABASE_URL!).pathname,
	'/altstack_development'
)
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const schema = await pool.query<{ name: string; schema: string }>(
	'SELECT current_database() AS name, current_schema() AS schema'
)
assert.equal(schema.rows[0].name, 'altstack_development')
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
const password = 'synthetic-local-test-password'
const env = {
	...process.env,
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
		['run', 'apps/server/dist/index.mjs'],
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

	const signUp = await fetch(new URL('/api/auth/sign-up/email', api), {
		method: 'POST',
		headers: { 'content-type': 'application/json', origin: web.origin },
		body: JSON.stringify({ email, password, name: 'Synthetic SSR user' }),
	})
	assert.equal(signUp.status, 200)
	const cookieHeaders = signUp.headers.getSetCookie()
	assert.ok(cookieHeaders.length > 0)
	for (const cookie of cookieHeaders) {
		assert.doesNotMatch(cookie, /;\s*domain=/i)
	}
	const cookie = cookieHeaders.map((value) => value.split(';')[0]).join('; ')
	const identity = (await signUp.json()) as { user: { id: string } }
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
		new Date(Date.now() + 60 * 60 * 24 * 1000),
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

	const signOut = await fetch(new URL('/api/auth/sign-out', api), {
		method: 'POST',
		headers: { cookie, origin: web.origin },
	})
	assert.equal(signOut.status, 200)
	redirectedToSignIn(await page('/submit', cookie))
	console.debug(
		'PASS: localhost host-only cookies, API session, SSR user header, protected /submit, SSR cookie refresh, sign-out guard; database limited to disposable development schema.'
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
	await pool.end()
}
