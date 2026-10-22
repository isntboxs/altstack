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
const evidence = await mkdtemp(join(tmpdir(), 'altstack-bookmarks-http-'))
const children: Array<ReturnType<typeof spawn>> = []
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

async function apiRequest(path: string, method = 'QUERY', cookie?: string) {
	return fetch(new URL(`/api/reference${path}`, api), {
		method,
		headers: { origin: web.origin, ...(cookie ? { cookie } : {}) },
	})
}
async function signup(name: string) {
	const accountEmail = `bookmark-${crypto.randomUUID()}@example.test`
	const response = await fetch(new URL('/api/auth/sign-up/email', api), {
		method: 'POST',
		headers: { 'content-type': 'application/json', origin: web.origin },
		body: JSON.stringify({ email: accountEmail, password, name }),
	})
	assert.equal(response.status, 200)
	const identity = (await response.json()) as { user: { id: string } }
	return {
		id: identity.user.id,
		email: accountEmail,
		cookie: response.headers
			.getSetCookie()
			.map((value) => value.split(';')[0])
			.join('; '),
	}
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
	const anonymous = await page('/bookmarks')
	assert.ok([302, 307].includes(anonymous.status))
	const destination = new URL(anonymous.headers.get('location')!, web)
	assert.equal(destination.pathname, '/auth/sign-in')
	assert.equal(destination.searchParams.get('returnTo'), '/bookmarks')
	const visitor = await signup('Bookmark QA user')
	const reviewer = await signup('Bookmark QA admin')
	await pool.query('UPDATE "user" SET role = $1 WHERE id = $2', [
		'admin',
		reviewer.id,
	])
	const fixture = await pool.query<{ id: string; slug: string }>(
		'SELECT id, slug FROM projects WHERE slug = $1',
		['test-workspace-baseline']
	)
	const project = fixture.rows[0]
	assert.ok(project)
	const path = `/bookmarks/${project.id}`
	assert.equal((await apiRequest(path, 'PUT')).status, 401)
	for (const account of [visitor, reviewer]) {
		assert.equal((await apiRequest(path, 'PUT', account.cookie)).status, 200)
		assert.equal((await apiRequest(path, 'PUT', account.cookie)).status, 200)
		assert.deepEqual(
			await (await apiRequest(path, 'QUERY', account.cookie)).json(),
			{ bookmarked: true }
		)
		const response = await page('/bookmarks', account.cookie)
		assert.equal(response.status, 200)
		assert.match(response.headers.get('cache-control')!, /private, no-store/)
		assert.match(response.headers.get('x-robots-tag')!, /noindex/)
		const html = await response.text()
		assert.match(html, /Your bookmarks/)
		assert.match(html, />Name<\/th>/)
		assert.match(html, />Description<\/th>/)
		assert.match(html, />Action<\/th>/)
		assert.match(html, /test-workspace-baseline/)
	}
	assert.equal((await pool.query('SELECT * FROM bookmarks')).rows.length, 2)
	assert.equal((await apiRequest(path, 'DELETE', reviewer.cookie)).status, 200)
	assert.deepEqual(
		await (await apiRequest(path, 'QUERY', visitor.cookie)).json(),
		{ bookmarked: true }
	)
	const list = await apiRequest('/bookmarks', 'QUERY', visitor.cookie)
	assert.match(list.headers.get('cache-control')!, /private, no-store/)
	const data = (await list.json()) as {
		bookmarks: Array<Record<string, unknown>>
	}
	assert.deepEqual(Object.keys(data.bookmarks[0]).toSorted(), [
		'id',
		'logo',
		'name',
		'slug',
		'tagline',
	])
	await pool.query('UPDATE projects SET status = $1 WHERE id = $2', [
		'removed',
		project.id,
	])
	assert.equal((await apiRequest(path, 'QUERY', visitor.cookie)).status, 404)
	assert.equal((await apiRequest(path, 'PUT', reviewer.cookie)).status, 404)
	const hidden = await page('/bookmarks', visitor.cookie)
	const hiddenHtml = await hidden.text()
	assert.doesNotMatch(hiddenHtml, /test-workspace-baseline/)
	assert.match(hiddenHtml, /No bookmarks yet/)
	await pool.query('UPDATE projects SET status = $1 WHERE id = $2', [
		'published',
		project.id,
	])
	assert.equal((await apiRequest(path, 'DELETE', visitor.cookie)).status, 200)
	assert.equal((await apiRequest(path, 'DELETE', visitor.cookie)).status, 200)
	assert.equal((await pool.query('SELECT * FROM bookmarks')).rows.length, 0)
	console.debug(
		'PASS: authenticated regular/admin persistence, duplicate save, private state/SSR, guest guard, noindex/no-store, unpublish visibility and idempotent remove; disposable development schema only.'
	)
	if (process.argv.includes('--preview')) {
		// Synthetic credentials only; this evidence file is private and temporary.
		const { writeFile, access } = await import('node:fs/promises')
		await writeFile(
			join(evidence, 'preview.json'),
			JSON.stringify({
				email: visitor.email,
				adminEmail: reviewer.email,
				password,
				slug: project.slug,
				projectId: project.id,
			}),
			{ mode: 0o600 }
		)
		console.debug(`PREVIEW_READY ${evidence}`)
		for (let attempt = 0; attempt < 1200; attempt++) {
			const stopped = await access(join(evidence, 'stop-preview')).then(
				() => true,
				() => false
			)
			if (stopped) break
			await new Promise((resolve) => setTimeout(resolve, 1000))
		}
	}
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
