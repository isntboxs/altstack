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
const evidence = await mkdtemp(join(tmpdir(), 'altstack-admin-reports-http-'))
const children: Array<ReturnType<typeof spawn>> = []
const mailbox = await createMagicLinkMailbox({
	preview: process.argv.includes('--preview'),
})
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
	const accountEmail = `report-${crypto.randomUUID()}@example.test`
	return mailbox.signIn(api, web, accountEmail, name)
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
	const guest = await page('/admin/reports')
	assert.ok([302, 307].includes(guest.status))
	assert.equal(
		new URL(guest.headers.get('location')!, web).pathname,
		'/auth/sign-in'
	)
	const visitor = await signup('Report QA user')
	const reviewer = await signup('Report QA admin')
	await pool.query('UPDATE "user" SET role = $1 WHERE id = $2', [
		'admin',
		reviewer.id,
	])
	const fixture = (
		await pool.query<{ id: string; slug: string }>(
			'SELECT id, slug FROM projects WHERE slug = $1',
			['test-workspace-baseline']
		)
	).rows[0]
	const draft = (
		await pool.query<{ id: string }>(
			`INSERT INTO projects (name, slug, repository_url, status) VALUES ('Unpublished QA tool', 'report-qa-draft', 'https://github.com/test/report-qa-draft', 'draft') RETURNING id`
		)
	).rows[0]
	await pool.query(
		`INSERT INTO github_repositories (project_id, owner, repo, fetched_at) VALUES ($1, 'test', 'report-qa-draft', now())`,
		[draft.id]
	)
	const reportIds: Array<string> = []
	for (let i = 0; i < 15; i++) {
		const result = await pool.query<{ id: string }>(
			`INSERT INTO project_reports (project_id, email, type, message, created_at) VALUES ($1, $2, $3, $4, now() - ($5 * interval '1 minute')) RETURNING id`,
			[
				i === 0 ? draft.id : fixture.id,
				`private-reporter-${i}@example.test`,
				i % 2 === 0 ? 'other' : 'outdated',
				i === 0
					? '<script>alert(1)</script> Keep this correction as plain text.'
					: `Private report message ${i}`,
				i,
			]
		)
		reportIds.push(result.rows[0].id)
	}
	const removed = (
		await pool.query<{ id: string }>(
			`INSERT INTO projects (name, slug, repository_url, status) VALUES ('Deleted tool', 'report-qa-deleted', 'https://github.com/test/report-qa-deleted', 'draft') RETURNING id`
		)
	).rows[0]
	await pool.query(
		`INSERT INTO project_reports (project_id, email, type, message) VALUES ($1, 'deleted-project-reporter@example.test', 'broken_link', 'The project has been deleted.')`,
		[removed.id]
	)
	await pool.query('DELETE FROM projects WHERE id = $1', [removed.id])
	const decisionPath = `/admin/reports/${reportIds.at(-1)}`
	for (const [cookie, status] of [
		[undefined, 401],
		[visitor.cookie, 403],
	] as const) {
		for (const response of [
			await apiRequest('/admin/reports', 'QUERY', cookie),
			await apiRequest(decisionPath, 'PATCH', cookie, { status: 'resolved' }),
		]) {
			assert.equal(response.status, status)
			assert.match(response.headers.get('cache-control')!, /private, no-store/)
			assert.doesNotMatch(
				await response.text(),
				/private-reporter|Private report/
			)
		}
	}
	const forbiddenPage = await page('/admin/reports', visitor.cookie)
	assert.ok([302, 307].includes(forbiddenPage.status))
	assert.equal(
		new URL(forbiddenPage.headers.get('location')!, web).pathname,
		'/'
	)
	const first = await apiRequest('/admin/reports', 'QUERY', reviewer.cookie)
	assert.equal(first.status, 200)
	assert.match(first.headers.get('cache-control')!, /private, no-store/)
	const firstData = (await first.json()) as {
		reports: Array<{
			id: string
			status: string
			project: { id: string; status: string } | null
		}>
		nextCursor: string
	}
	assert.equal(firstData.reports.length, 12)
	assert.ok(firstData.reports.every((report) => report.status === 'open'))
	assert.ok(firstData.reports.some((report) => report.project === null))
	assert.ok(
		firstData.reports.some((report) => report.project?.status === 'draft')
	)
	const second = await apiRequest(
		`/admin/reports?cursor=${firstData.nextCursor}`,
		'QUERY',
		reviewer.cookie
	)
	const secondData = (await second.json()) as {
		reports: Array<{ id: string }>
		nextCursor: string | null
	}
	assert.equal(secondData.reports.length, 4)
	assert.equal(secondData.nextCursor, null)
	assert.ok(
		secondData.reports.every(
			(report) =>
				!firstData.reports.some((firstReport) => firstReport.id === report.id)
		)
	)
	assert.equal(
		(
			await apiRequest(decisionPath, 'PATCH', reviewer.cookie, {
				status: 'resolved',
			})
		).status,
		200
	)
	assert.equal(
		(
			await apiRequest(decisionPath, 'PATCH', reviewer.cookie, {
				status: 'dismissed',
			})
		).status,
		409
	)
	assert.equal(
		(
			await apiRequest(decisionPath, 'PATCH', reviewer.cookie, {
				status: 'open',
			})
		).status,
		400
	)
	assert.equal(
		(
			await apiRequest(
				`/admin/reports/${crypto.randomUUID()}`,
				'PATCH',
				reviewer.cookie,
				{ status: 'resolved' }
			)
		).status,
		404
	)
	const resolved = await apiRequest(
		'/admin/reports?status=resolved',
		'QUERY',
		reviewer.cookie
	)
	assert.equal(
		((await resolved.json()) as { reports: Array<unknown> }).reports.length,
		1
	)
	for (const path of ['/', `/${fixture.slug}`]) {
		const response = await page(path)
		assert.equal(response.status, 200)
		assert.doesNotMatch(
			await response.text(),
			/private-reporter|Private report message|Keep this correction as plain text/
		)
	}
	const adminPage = await page('/admin/reports', reviewer.cookie)
	assert.equal(adminPage.status, 200)
	assert.match(adminPage.headers.get('cache-control')!, /private, no-store/)
	assert.match(adminPage.headers.get('x-robots-tag')!, /noindex/)
	assert.match(await adminPage.text(), /Reports/)
	console.debug(
		'PASS: real session admin/user/guest guards, private no-store REST/SSR, status decisions and conflicts, filtered cursor pages, unpublished/deleted targets, public HTML privacy; disposable schema only.'
	)
	if (process.argv.includes('--preview')) {
		const { writeFile, access } = await import('node:fs/promises')
		await writeFile(
			join(evidence, 'preview.json'),
			JSON.stringify({
				mailboxURL: mailbox.previewURL,
				email: visitor.email,
				adminEmail: reviewer.email,
				projectId: draft.id,
				reportId: reportIds[0],
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
	await mailbox.close()
	await pool.end()
}
