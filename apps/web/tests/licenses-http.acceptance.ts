import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import { access, cp, mkdtemp, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

// test:scoped owns the disposable schema. Never migrate/reset public app data.
assert.equal(process.env.NODE_ENV, 'test')
assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/altstack_test')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const scope = await pool.query<{ schema: string }>(
	'select current_schema() as schema'
)
assert.match(scope.rows[0].schema, /^altstack_test_[a-f0-9]{32}$/)
const web = new URL(process.env.VITE_APP_URL!)
const api = new URL(process.env.VITE_SERVER_URL!)
for (const url of [web, api]) {
	assert.equal(url.protocol, 'http:')
	assert.equal(url.hostname, 'localhost')
	assert.ok(url.port)
}
const workspace = fileURLToPath(new URL('../../../', import.meta.url))
const evidence = await mkdtemp(join(tmpdir(), 'altstack-licenses-http-'))
const children: Array<ReturnType<typeof spawn>> = []
function start(
	command: string,
	args: Array<string>,
	name: string,
	port: string
) {
	const log = createWriteStream(join(evidence, `${name}.log`), { mode: 0o600 })
	const child = spawn(command, args, {
		cwd: workspace,

		stdio: ['ignore', 'pipe', 'pipe'],
		env: {
			...process.env,
			NODE_ENV: 'production',
			PORT: port,
			HOST: '127.0.0.1',
			GITHUB_TOKEN: '',
			BETTER_AUTH_COOKIE_DOMAIN: '',
			BETTER_AUTH_URL: api.origin,
			CORS_ORIGINS: web.origin,
		},
	})
	child.stdout.pipe(log)
	child.stderr.pipe(log)
	children.push(child)
	return child
}
async function ready(url: string, child: ReturnType<typeof spawn>) {
	for (let attempt = 0; attempt < 150; attempt++) {
		assert.equal(child.exitCode, null, `Server exited; logs: ${evidence}`)
		try {
			if ((await fetch(url)).ok) return
		} catch {
			/* Cold startup. */
		}
		await new Promise((resolve) => setTimeout(resolve, 200))
	}
	throw new Error(`Server startup failed; logs: ${evidence}`)
}
try {
	const category = (
		await pool.query<{ id: string; path: string }>(
			"select c.id, p.path from categories c join category_paths p on p.category_id = c.id where c.slug = 'backend' limit 1"
		)
	).rows[0]
	const tag = (
		await pool.query<{ id: string }>(
			"insert into tags (slug, name) values ('qa-license', 'License QA') returning id"
		)
	).rows[0]
	for (let index = 0; index < 21; index++) {
		const slug = `qa-license-${index}`
		const detected = index < 16 ? 'MIT' : index < 18 ? 'Apache-2.0' : null
		const status = index === 20 ? 'draft' : 'published'
		const id = (
			await pool.query<{ id: string }>(
				`insert into projects (name, slug, repository_url, status, tagline, description, logo) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
				[
					index === 15
						? 'License QA Telescope'
						: `License QA ${String(index).padStart(2, '0')}`,
					slug,
					`https://github.com/altstack-test-fixtures/${slug}`,
					status,
					'Useful open source licensing tools for productive teams.',
					'Synthetic catalogue fixture for license discovery, archived metadata, and search validation.',
					'test-fixtures/baseline.svg',
				]
			)
		).rows[0].id
		await pool.query(
			`insert into github_repositories (project_id, owner, repo, stars, forks, fetched_at, metadata_fetched_at, last_commit_at, repository_created_at, license_key, license_name, license_spdx_id, license_slug, license_url, archived) values ($1,'altstack-test-fixtures',$2,$3,12,now(),now(),now() - interval '12 hours','2020-01-01',$4,$5,$6,$7,$8,$9)`,
			[
				id,
				slug,
				20000 + index * 100,
				index === 20 ? 'private-only' : (detected?.toLowerCase() ?? 'other'),
				index === 20
					? 'Private license'
					: detected
						? `${detected} License`
						: 'Other',
				index === 20 ? 'Private-Only' : (detected ?? 'NOASSERTION'),
				index === 20 ? 'private-only' : (detected?.toLowerCase() ?? null),
				detected ? `https://spdx.org/licenses/${detected}.html` : null,
				index === 15,
			]
		)
		await pool.query(
			'insert into project_categories (project_id, category_id) values ($1,$2)',
			[id, category.id]
		)
		await pool.query(
			'insert into project_tags (project_id, tag_id) values ($1,$2)',
			[id, tag.id]
		)
	}
	const server = start(
		'bun',
		['run', 'apps/server/dist/index.mjs'],
		'api',
		api.port
	)
	await ready(new URL('/api/auth/ok', api).href, server)
	// Keep an inspecting user's preview independent from subsequent local builds.
	const webOutput = join(evidence, 'web-output')
	await cp(join(workspace, 'apps/web/.output'), webOutput, { recursive: true })
	await symlink(
		join(workspace, 'apps/web/node_modules'),
		join(webOutput, 'node_modules'),
		'dir'
	)
	const client = start(
		process.execPath,
		[join(webOutput, 'server/index.mjs')],
		'web',
		web.port
	)
	await ready(new URL('/robots.txt', web).href, client)
	for (const [path, status, text] of [
		['/', 200, 'License'],
		['/licenses', 200, 'Browse Open Source Software Licenses'],
		['/licenses/mit', 200, '16 published projects licensed under MIT.'],
		['/licenses/mit?page=2', 200, 'License QA'],
		['/licenses/mit?q=absentuniquetoken', 200, 'No projects found'],
		['/licenses/mit?page=999', 200, 'No projects on this page'],
		['/licenses/unknown', 200, 'Projects with unknown License'],
		['/licenses/private-only', 404, 'License not found'],
		['/licenses/missing', 404, 'License not found'],
		['/qa-license-15', 200, 'Archived'],
		['/qa-license-18', 200, 'unknown'],
		[`/categories/${category.path}`, 200, 'License'],
		['/tags/qa-license', 200, 'License'],
	] as const) {
		const response = await fetch(new URL(path, web))
		assert.equal(response.status, status, path)
		const html = await response.text()
		assert.ok(
			html.replace(/<!--[\s\S]*?-->/g, '').includes(text),
			`${path}: missing ${text}`
		)
		assert.ok(!html.includes('Private license'), `${path}: leaked draft`)
		if (
			path.includes('?q=') ||
			path.includes('page=999') ||
			path.endsWith('/unknown')
		) {
			assert.match(html, /noindex, follow/)
		}
	}
	const canonical = await fetch(new URL('/licenses/MIT?sort=name-desc', web), {
		redirect: 'manual',
	})
	assert.equal(canonical.status, 308)
	assert.ok(canonical.headers.get('location')?.includes('/licenses/mit'))
	const sitemap = await fetch(new URL('/sitemaps/pages.xml', web))
	assert.equal(sitemap.status, 200)
	const xml = await sitemap.text()
	for (const slug of ['mit', 'apache-2.0']) {
		assert.ok(xml.includes(`/licenses/${slug}`))
	}
	for (const slug of ['unknown', 'private-only']) {
		assert.ok(!xml.includes(`/licenses/${slug}`))
	}
	console.debug(`LICENSE_HTTP_PASSED ${evidence}`)
	if (process.argv.includes('--preview')) {
		console.debug(`PREVIEW_READY ${evidence} ${web.origin}/licenses`)
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
		child.kill('SIGTERM')
		await Promise.race([
			exited,
			new Promise((resolve) => setTimeout(resolve, 4000)),
		])
		if (stillRunning()) {
			child.kill('SIGKILL')
			await exited
		}
	}
	await pool.end()
}
