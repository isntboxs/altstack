import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

// Run with Node so detached server process groups terminate independently.
// Only test:scoped may supply this process's database and own its cleanup.
assert.equal(
	process.versions.bun,
	undefined,
	'Run HTTP acceptance with vp exec node'
)
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
const evidence = await mkdtemp(join(tmpdir(), 'altstack-featured-http-'))
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

async function apiRequest(
	path: string,
	method = 'QUERY',
	cookie?: string,
	body?: unknown
) {
	return fetch(new URL(`/api/reference${path}`, api), {
		method,
		headers: {
			origin: web.origin,
			...(cookie ? { cookie } : {}),
			...(body ? { 'content-type': 'application/json' } : {}),
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	})
}
async function signup(name: string) {
	const accountEmail = `featured-${crypto.randomUUID()}@example.test`
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
	const visitor = await signup('Featured QA user')
	const reviewer = await signup('Featured QA admin')
	await pool.query('UPDATE "user" SET role = $1 WHERE id = $2', [
		'admin',
		reviewer.id,
	])
	const targets: Array<{ id: string; slug: string }> = []
	for (let index = 0; index < 8; index++) {
		const slug = `test-featured-${index}`
		const row = (
			await pool.query<{ id: string; slug: string }>(
				`INSERT INTO projects (name, slug, repository_url, status, tagline, description, logo, website_url, content) VALUES ($1, $2, $3, 'published', $4, $5, $6, $7, $8) RETURNING id, slug`,
				[
					index === 0 ? 'Featured QA source' : `Featured Tool ${index}`,
					slug,
					`https://github.com/altstack-test-fixtures/${slug}`,
					'Open-source tools for productive teams.',
					'A synthetic project for featured layout and interaction verification.',
					'test-fixtures/baseline.svg',
					`https://example.com/featured-${index}`,
					index === 0
						? Array.from(
								{ length: 24 },
								(_, n) =>
									`## Project section ${n + 1}\n\nUseful project documentation for this synthetic fixture. Browse the features, setup instructions, and integration examples.\n\n`
							).join('')
						: null,
				]
			)
		).rows[0]
		targets.push(row)
		await pool.query(
			`INSERT INTO github_repositories (project_id, owner, repo, stars, forks, fetched_at) VALUES ($1, 'altstack-test-fixtures', $2, $3, 12, now())`,
			[row.id, slug, 1234 + index]
		)
	}
	const path = '/admin/featured-projects'
	for (const [cookie, status] of [
		[undefined, 401],
		[visitor.cookie, 403],
	] as const) {
		assert.equal((await apiRequest(path, 'QUERY', cookie)).status, status)
		assert.equal(
			(
				await apiRequest(path, 'PUT', cookie, {
					projectIds: [],
					expectedProjectIds: [],
				})
			).status,
			status
		)
	}
	const guestAdmin = await page('/admin/featured')
	assert.ok([302, 307].includes(guestAdmin.status))
	assert.equal(
		new URL(guestAdmin.headers.get('location')!, web).pathname,
		'/auth/sign-in'
	)
	const normalAdmin = await page('/admin/featured', visitor.cookie)
	assert.ok([302, 307].includes(normalAdmin.status))
	assert.equal(new URL(normalAdmin.headers.get('location')!, web).pathname, '/')
	const ids = targets.map(({ id }) => id)
	const save = await apiRequest(path, 'PUT', reviewer.cookie, {
		projectIds: ids,
		expectedProjectIds: [],
	})
	assert.equal(save.status, 200)
	assert.deepEqual(
		((await save.json()) as { projects: Array<{ id: string }> }).projects.map(
			({ id }) => id
		),
		ids
	)
	assert.equal(
		(
			await apiRequest(path, 'PUT', reviewer.cookie, {
				projectIds: [],
				expectedProjectIds: [],
			})
		).status,
		409
	)
	const detail = await apiRequest(`/projects/${targets[0].slug}`)
	assert.equal(detail.status, 200)
	const data = (await detail.json()) as {
		featuredProjects: Array<{ id: string; websiteUrl: string }>
	}
	assert.deepEqual(
		data.featuredProjects.map(({ id }) => id),
		ids.slice(1)
	)
	const html = await page(`/${targets[0].slug}`)
	assert.equal(html.status, 200)
	const markup = await html.text()
	assert.match(markup, /Featured Projects/)
	assert.match(markup, /Visit Featured Tool 1 website/)
	assert.match(markup, /href="https:\/\/example.com\/featured-1"/)
	assert.doesNotMatch(
		await (await page('/')).text(),
		/aria-label="Featured projects"/
	)
	const admin = await page('/admin/featured', reviewer.cookie)
	assert.equal(admin.status, 200)
	assert.match(admin.headers.get('cache-control')!, /private, no-store/)
	assert.match(admin.headers.get('x-robots-tag')!, /noindex/)
	assert.match(await admin.text(), /Selected projects/)
	await pool.query(`UPDATE projects SET status = 'draft' WHERE id = $1`, [
		targets[1].id,
	])
	const filtered = (await (
		await apiRequest(`/projects/${targets[0].slug}`)
	).json()) as typeof data
	assert.ok(!filtered.featuredProjects.some(({ id }) => id === targets[1].id))
	await pool.query(`UPDATE projects SET status = 'published' WHERE id = $1`, [
		targets[1].id,
	])
	console.debug(
		'PASS: real-session admin authorization, private/noindex admin SSR, persistence, stale-save conflict, published-only/self-excluding detail previews, external website links, and unchanged homepage; disposable schema only.'
	)
	if (process.argv.includes('--preview')) {
		const { writeFile, access } = await import('node:fs/promises')
		await writeFile(
			join(evidence, 'preview.json'),
			JSON.stringify({
				email: visitor.email,
				adminEmail: reviewer.email,
				password,
				slug: targets[0].slug,
				projectId: targets[0].id,
				featuredIds: ids,
				web: web.origin,
				api: api.origin,
			}),
			{ mode: 0o600 }
		)
		console.debug(`PREVIEW_READY ${evidence}`)
		for (let attempt = 0; attempt < 1200; attempt++) {
			if (
				await access(join(evidence, 'stop-preview')).then(
					() => true,
					() => false
				)
			) {
				break
			}
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
