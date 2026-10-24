import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import { access, writeFile, mkdtemp } from 'node:fs/promises'
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
const evidence = await mkdtemp(join(tmpdir(), 'altstack-ownership-http-'))
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
	// Accounts are created through the real public Magic Link flow. Only the
	// loopback Resend transport is replaced; no authentication shortcuts exist.
	const claimant = await signup('Project representative')
	const reviewer = await signup('Independent admin')
	const stranger = await signup('Unrelated account')
	await pool.query('UPDATE "user" SET role = $1 WHERE id = $2', [
		'admin',
		reviewer.id,
	])
	const id = crypto.randomUUID(),
		secondId = crypto.randomUUID()
	for (const [projectId, slug, name, created] of [
		[id, 'ownership-preview', 'AltStack Studio', '2026-10-01'],
		[secondId, 'ownership-newer', 'Newer unverified project', '2026-10-24'],
	]) {
		await pool.query(
			`INSERT INTO projects (id,name,slug,tagline,description,logo,repository_url,status,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,'published',$8)`,
			[
				projectId,
				name,
				slug,
				'An open source workspace for useful software.',
				'A synthetic project for verification and owner editing acceptance.',
				'',
				`https://github.com/altstack-test-fixtures/${slug}`,
				created,
			]
		)
		await pool.query('UPDATE projects SET logo = $1 WHERE id = $2', [
			`projects/${slug}/logo-${crypto.randomUUID()}.png`,
			projectId,
		])
		await pool.query(
			'INSERT INTO github_repositories (project_id,owner,repo,stars,forks,fetched_at) VALUES ($1,$2,$3,1234,56,now())',
			[projectId, 'altstack-test-fixtures', slug]
		)
		await pool.query(
			'INSERT INTO project_categories (project_id,category_id) SELECT $1,id FROM categories WHERE slug = $2',
			[projectId, 'backend']
		)
	}
	const guest = await page('/managed')
	assert.ok([302, 307].includes(guest.status))
	assert.equal((await apiRequest(`/managed-projects/${id}`)).status, 401)
	assert.equal(
		(
			await apiRequest(`/projects/${id}/claim`, 'POST', undefined, {
				email: 'nobody@example.test',
				role: 'owner',
			})
		).status,
		401
	)
	const request = await apiRequest(
		`/projects/${id}/claim`,
		'POST',
		claimant.cookie,
		{ email: 'representative@example.test', role: 'maintainer' }
	)
	assert.equal(request.status, 200)
	assert.match(request.headers.get('cache-control')!, /private, no-store/)
	const challenge = (await request.json()) as { challengeId: string }
	const mail = mailbox.messages.findLast(
		(message) => message.to === 'representative@example.test'
	)!
	assert.ok(mail)
	const code = /\b([0-9]{6})\b/.exec(mail.text)![1]
	assert.ok(code)
	const stored = (
		await pool.query<{ code_hash: string | null }>(
			'SELECT code_hash FROM project_claims WHERE challenge_id = $1',
			[challenge.challengeId]
		)
	).rows[0]
	assert.ok(stored.code_hash && stored.code_hash !== code)
	assert.equal(
		(await apiRequest(`/managed-projects/${id}`, 'QUERY', claimant.cookie))
			.status,
		404
	)
	assert.equal(
		(
			await apiRequest(
				`/projects/${secondId}/claim/verify`,
				'POST',
				claimant.cookie,
				{ challengeId: challenge.challengeId, code }
			)
		).status,
		400
	)
	const confirmation = await apiRequest(
		`/projects/${id}/claim/verify`,
		'POST',
		claimant.cookie,
		{ challengeId: challenge.challengeId, code }
	)
	assert.equal(confirmation.status, 200)
	assert.equal(
		(
			await apiRequest(
				`/projects/${id}/claim/verify`,
				'POST',
				claimant.cookie,
				{ challengeId: challenge.challengeId, code }
			)
		).status,
		400
	)
	const firstInbox = await apiRequest(
		'/project-claims',
		'QUERY',
		reviewer.cookie
	)
	const inbox = (await firstInbox.json()) as { claims: Array<{ id: string }> }
	assert.equal(inbox.claims.length, 1)
	assert.equal(
		(
			await apiRequest(
				`/project-claims/${inbox.claims[0].id}`,
				'POST',
				stranger.cookie,
				{ decision: 'approve' }
			)
		).status,
		404
	)
	assert.equal(
		(
			await apiRequest(
				`/project-claims/${inbox.claims[0].id}`,
				'POST',
				reviewer.cookie,
				{ decision: 'approve' }
			)
		).status,
		200
	)
	const managed = await apiRequest(
		`/managed-projects/${id}`,
		'QUERY',
		claimant.cookie
	)
	assert.equal(managed.status, 200)
	assert.match(managed.headers.get('cache-control')!, /private, no-store/)
	const data = (await managed.json()) as { revision: string }
	assert.equal(
		(
			await apiRequest(`/managed-projects/${id}`, 'PATCH', stranger.cookie, {
				revision: data.revision,
				name: 'Intrusion',
			})
		).status,
		404
	)
	assert.equal(
		(
			await apiRequest(
				`/managed-projects/${secondId}`,
				'PATCH',
				claimant.cookie,
				{ revision: data.revision, name: 'Cross-project' }
			)
		).status,
		404
	)
	assert.equal(
		(
			await apiRequest(`/managed-projects/${id}`, 'PATCH', claimant.cookie, {
				revision: data.revision,
				status: 'removed',
			})
		).status,
		400
	)
	assert.equal(
		(
			await apiRequest(`/managed-projects/${id}`, 'PATCH', claimant.cookie, {
				revision: data.revision,
				tagline: 'Maintained by an approved representative.',
			})
		).status,
		200
	)
	const privatePage = await page(`/managed/${id}`, claimant.cookie)
	assert.equal(privatePage.status, 200)
	assert.match(privatePage.headers.get('cache-control')!, /private, no-store/)
	assert.ok(
		(await privatePage.text()).includes('Publish changes'),
		'Managed editor must render its publish action'
	)
	const publicPage = await page('/ownership-preview')
	const html = await publicPage.text()
	assert.match(html, /Verified project/)
	assert.doesNotMatch(html, /representative@example.test|code_hash|reviewer_id/)
	const home = await page('/')
	const homeHtml = await home.text()
	assert.ok(
		homeHtml.indexOf('AltStack Studio') <
			homeHtml.indexOf('Newer unverified project')
	)
	const latest = await page('/?sort=newest')
	const latestHtml = await latest.text()
	assert.ok(
		latestHtml.indexOf('Newer unverified project') <
			latestHtml.indexOf('AltStack Studio')
	)
	console.debug(
		'PASS: real Magic Link sessions, claim mail delivery/OTP, approval, scoped public edits, no-store REST/SSR, private public projection and home ranking; disposable schema only.'
	)
	if (process.argv.includes('--preview')) {
		await writeFile(
			join(evidence, 'preview.json'),
			JSON.stringify({
				webURL: web.origin,
				apiURL: api.origin,
				mailboxURL: mailbox.previewURL,
				projectId: id,
				secondId,
				claimantEmail: claimant.email,
				reviewerEmail: reviewer.email,
				strangerEmail: stranger.email,
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
