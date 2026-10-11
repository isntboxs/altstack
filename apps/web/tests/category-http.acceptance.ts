import { createRouterClient } from '@orpc/server'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import { access, mkdir, mkdtemp, open, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
	createAdminCategory,
	updateAdminCategory,
} from '@altstack/api/queries/category-integrity'
import { routers } from '@altstack/api/routers'

import { createZedFixture } from '../../../packages/db/tests/fixtures/category-hierarchy'
import { connectTestPostgres } from '../../../packages/db/tests/helpers/postgres'

// Run via @altstack/db test:isolated. Its validated session lock owns public
// through final restoration. This acceptance script never resets a database.
assert.equal(process.env.NODE_ENV, 'test')
assert.equal(process.env.APP_NAME, 'Altstack Test')
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
let evidence: string
const origin = 'http://localhost:3010'
const apiOrigin = 'http://localhost:3001'
const serverEnv = {
	...process.env,
	VITE_APP_NAME: 'Altstack Test',
	VITE_APP_URL: origin,
	VITE_SERVER_URL: apiOrigin,
	VITE_S3_PUBLIC_URL: origin,
	CORS_ORIGINS: origin,
	BETTER_AUTH_URL: apiOrigin,
}
const processes: Array<ReturnType<typeof spawn>> = []
const fixtures: Array<Awaited<ReturnType<typeof createZedFixture>>> = []
const assetPath = join(workspace, 'apps/web/public/test-fixtures/zed.svg')
let assetCreated = false
const preview = process.argv.includes('--preview')
const checks: Array<string> = []

function start(
	command: string,
	args: Array<string>,
	cwd: string,
	name: string
) {
	const output = createWriteStream(join(evidence, name + '.log'), {
		mode: 0o600,
	})
	const child = spawn(command, args, {
		cwd,
		env: { ...serverEnv, PORT: name === 'web' ? '3010' : '3001' },
		detached: true,
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	child.stdout.pipe(output)
	child.stderr.pipe(output)
	processes.push(child)
	return child
}
async function stop(child: ReturnType<typeof spawn>) {
	if (child.exitCode !== null || child.signalCode !== null || !child.pid) return
	const exited = once(child, 'exit')
	const stillRunning = () =>
		child.exitCode === null && child.signalCode === null
	process.kill(-child.pid, 'SIGTERM')
	await Promise.race([exited, new Promise((done) => setTimeout(done, 5000))])
	if (stillRunning()) {
		process.kill(-child.pid, 'SIGKILL')
		await exited
	}
}
async function http(path: string) {
	const response = await fetch(origin + path, { redirect: 'manual' })
	const html = await response.text()
	await writeFile(join(evidence, 'last-response.html'), html, { mode: 0o600 })
	return { response, html }
}
function main(html: string) {
	const content = /<main\b[^>]*>([\s\S]*?)<\/main>/.exec(html)?.[1]
	assert.ok(content, 'SSR must render main content')
	return content.replace(/<!--.*?-->/g, '')
}
function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#x27;')
}
function hasHeading(html: string, text: string) {
	assert.ok(
		main(html).includes(escapeHtml(text)),
		'Missing SSR heading: ' + text
	)
	assert.match(main(html), /<h1\b/)
}
function canonical(html: string, path: string) {
	assert.ok(
		html.includes('rel="canonical" href="' + origin + path + '"'),
		'Missing clean app-origin canonical'
	)
}
async function waitForServer() {
	const deadline = Date.now() + 90_000
	while (Date.now() < deadline) {
		assert.ok(
			processes.every((child) => child.exitCode === null),
			'A local test server stopped; logs are in the private evidence directory'
		)
		try {
			if (
				(await fetch(apiOrigin, { method: 'QUERY' })).ok &&
				(await fetch(origin + '/categories')).ok
			) {
				return
			}
		} catch {
			/* Server is compiling. */
		}
		await new Promise((done) => setTimeout(done, 500))
	}
	throw new Error('Local test servers did not become ready')
}
async function checkpoint(phase: string, data: Record<string, unknown>) {
	await writeFile(
		join(evidence, 'preview.json'),
		JSON.stringify({ phase, origin, ...data }, null, 2),
		{ mode: 0o600 }
	)
	if (!preview) return
	console.debug(JSON.stringify({ previewCheckpoint: phase, evidence, ...data }))
	const deadline = Date.now() + 20 * 60_000
	while (Date.now() < deadline) {
		try {
			await access(join(evidence, 'continue-' + phase))
			return
		} catch {
			/* Wait for collaborative browser verification. */
		}
		await new Promise((done) => setTimeout(done, 500))
	}
	throw new Error('Collaborative preview checkpoint timed out')
}

const database = await connectTestPostgres()
try {
	const lock = await database.pool.query<{ held: boolean }>(
		"SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND granted AND classid = hashtext('altstack.workspace-verification')::oid AND objid = hashtext('drizzle')::oid) AS held"
	)
	assert.equal(
		lock.rows[0]?.held,
		true,
		'Use the authorized test:isolated wrapper'
	)
	evidence = await mkdtemp(join(tmpdir(), 'altstack-category-acceptance-'))
	const client = createRouterClient(routers, {
		context: { db: database.db, auth: null },
	})
	const published = await createZedFixture(database.db, 'published')
	fixtures.push(published)
	const draft = await createZedFixture(database.db, 'draft')
	fixtures.push(draft)
	const publishedRow = await database.db.query.project.findFirst({
		where: { id: published.projectId },
	})
	const draftRow = await database.db.query.project.findFirst({
		where: { id: draft.projectId },
	})
	assert.ok(publishedRow)
	assert.ok(draftRow)
	// Keep fixture assets local; browser acceptance never contacts GitHub/storage.
	await mkdir(dirname(assetPath), { recursive: true })
	const assetFile = await open(assetPath, 'wx')
	assetCreated = true
	try {
		await assetFile.writeFile(
			'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#202020"/><path d="M17 19h30L17 45h30" fill="none" stroke="#fafafa" stroke-width="5"/></svg>'
		)
	} finally {
		await assetFile.close()
	}
	start('bun', ['run', 'src/index.ts'], join(workspace, 'apps/server'), 'api')
	start(
		'vp',
		['dev', '--port', '3010', '--host', '127.0.0.1', '--strictPort'],
		join(workspace, 'apps/web'),
		'web'
	)
	await waitForServer()

	const rootResponse = await fetch(apiOrigin, { method: 'QUERY' })
	assert.equal(rootResponse.status, 200)
	assert.equal(await rootResponse.text(), 'Altstack server is running!')
	assert.equal((await fetch(apiOrigin)).status, 404)
	const healthUrl = apiOrigin + '/api/reference/health'
	const health = await fetch(healthUrl, { method: 'QUERY' })
	assert.equal(health.status, 200)
	assert.deepEqual(await health.json(), { message: 'OK' })
	assert.equal((await fetch(healthUrl)).status, 404)
	const rpcHealthUrl = apiOrigin + '/api/rpc/health'
	const rpcHealth = await fetch(rpcHealthUrl, { method: 'QUERY' })
	assert.equal(rpcHealth.status, 200)
	assert.deepEqual(await rpcHealth.json(), { json: { message: 'OK' } })
	assert.equal((await fetch(rpcHealthUrl)).status, 404)
	const preflight = await fetch(healthUrl, {
		method: 'OPTIONS',
		headers: {
			origin,
			'access-control-request-method': 'QUERY',
		},
	})
	assert.equal(preflight.status, 204)
	assert.equal(preflight.headers.get('access-control-allow-origin'), origin)
	assert.ok(
		preflight.headers.get('access-control-allow-methods')?.includes('QUERY')
	)
	checks.push(
		'QUERY root/REST/RPC preserve 200 bodies, reject GET, and allow CORS'
	)

	const rootPath = 'developer-tools'
	const parentPath = rootPath + '/ides-code-editors'
	const aiPath = parentPath + '/ai-powered-editors'
	const generalPath = parentPath + '/general-purpose-editors'
	const list = await http('/categories')
	assert.equal(list.response.status, 200)
	hasHeading(list.html, 'Open Source Software Categories')
	canonical(list.html, '/categories')
	assert.ok(main(list.html).includes('href="/categories/' + parentPath + '"'))
	assert.ok(!main(list.html).includes('href="/categories/' + aiPath + '"'))
	checks.push('SSR index groups roots/direct children and reserves /categories')

	for (const path of [rootPath, parentPath, aiPath, generalPath]) {
		const detail = await client.category.getByPath({ query: { path } })
		assert.equal(detail.category.projectCount, 1)
		const search = await client.project.search({
			query: {
				category: detail.category.slug,
			},
		})
		assert.equal(search.pagination.totalItems, 1)
		assert.deepEqual(
			search.projects.map((project) => project.id),
			[published.projectId]
		)
		const page = await http('/categories/' + path + '?sort=name')
		assert.equal(page.response.status, 200)
		hasHeading(page.html, 'Open Source ' + detail.category.name)
		canonical(page.html, '/categories/' + path)
		assert.ok(
			page.html.includes(
				'<meta name="description" content="' +
					escapeHtml(detail.category.description ?? '') +
					'"'
			)
		)
		assert.ok(
			main(page.html).includes(escapeHtml(detail.category.description ?? ''))
		)
		assert.ok(main(page.html).includes('aria-label="breadcrumb"'))
		assert.equal(
			(
				main(page.html).match(
					new RegExp('href="/' + publishedRow.slug + '"', 'g')
				) ?? []
			).length,
			1
		)
		for (const ancestor of detail.ancestors) {
			assert.ok(
				main(page.html).includes('href="/categories/' + ancestor.path + '"')
			)
		}
		assert.equal(
			main(page.html).includes('aria-label="See also"'),
			detail.children.length > 0
		)
	}
	checks.push(
		'Published synthetic Zed appears once at both sibling leaves and both ancestors with unique counts and SSR data'
	)

	const detail = await http('/' + publishedRow.slug)
	const categorySection =
		/<section aria-labelledby="project-categories-heading"[\s\S]*?<\/section>/.exec(
			main(detail.html)
		)?.[0]
	assert.ok(categorySection)
	assert.equal((categorySection.match(/<a\b/g) ?? []).length, 2)
	assert.ok(categorySection.includes('href="/categories/' + aiPath + '"'))
	assert.ok(categorySection.includes('href="/categories/' + generalPath + '"'))
	assert.ok(!categorySection.includes('>Developer Tools<'))
	checks.push('SSR project detail has exactly two direct linked badges')

	const draftDetail = await http('/' + draftRow.slug)
	assert.equal(draftDetail.response.status, 404)
	const empty = await http('/categories/frontend')
	assert.equal(empty.response.status, 200)
	assert.ok(
		main(empty.html).includes(
			'There are no published projects in this category yet.'
		)
	)
	const unmatched = await http(
		'/categories/' + aiPath + '?q=unmatchedfixturetoken'
	)
	assert.equal(unmatched.response.status, 200)
	assert.ok(
		main(unmatched.html).includes('No projects match your current filters.')
	)
	for (const path of [
		'unknown',
		'backend/ides-code-editors',
		'developer-tools/ai-powered-editors',
		'a/b/c/d',
		'developer-tools//ides-code-editors',
		'bad%20path',
	]) {
		const invalid = await http('/categories/' + path)
		assert.equal(invalid.response.status, 404, path + ' must be real HTTP 404')
		hasHeading(invalid.html, 'Category not found')
	}
	checks.push(
		'Real HTTP 404 for drafts/unknown/wrong/malformed paths; valid empty and filtered categories are HTTP 200'
	)
	await checkpoint('initial', {
		publishedSlug: publishedRow.slug,
		draftSlug: draftRow.slug,
		aiPath,
		parentPath,
		generalPath,
	})

	const root = (await client.category.getByPath({ query: { path: rootPath } }))
		.category
	const parent = (
		await client.category.getByPath({ query: { path: parentPath } })
	).category
	const history = [aiPath]
	await updateAdminCategory(database.db, {
		id: root.id,
		slug: 'test-developer-tools',
	})
	history.push('test-developer-tools/ides-code-editors/ai-powered-editors')
	await updateAdminCategory(database.db, {
		id: root.id,
		slug: 'test-engineering',
	})
	await updateAdminCategory(database.db, {
		id: parent.id,
		slug: 'test-editors',
	})
	history.push('test-engineering/test-editors/ai-powered-editors')
	await updateAdminCategory(database.db, {
		id: parent.id,
		slug: 'test-code-editors',
	})
	const workbench = await createAdminCategory(database.db, {
		name: 'Test Workbench',
		slug: 'test-workbench',
		description: 'Synthetic workbench for hierarchy acceptance.',
		parentId: null,
	})
	await updateAdminCategory(database.db, {
		id: parent.id,
		parentId: workbench.id,
	})
	const currentPath = 'test-workbench/test-code-editors/ai-powered-editors'
	const query =
		'?q=Zed&sort=name&page=1&campaign=a%20b&campaign=c%2Fd&returnTo=https%3A%2F%2Fevil.test&empty=&encoded=%252F'
	for (const path of history) {
		const redirect = await http('/categories/' + path + query)
		assert.equal(redirect.response.status, 308)
		assert.equal(
			redirect.response.headers.get('Location'),
			'/categories/' + currentPath + query
		)
		const current = await http(redirect.response.headers.get('Location')!)
		assert.equal(current.response.status, 200)
		assert.equal(current.response.headers.get('Location'), null)
		canonical(current.html, '/categories/' + currentPath)
		hasHeading(current.html, 'Open Source AI-Powered Editors')
	}
	const latest = await client.project.getBySlug({
		params: { slug: publishedRow.slug },
	})
	assert.deepEqual(
		latest.categoryDetails.map((node) => node.path),
		[currentPath, 'test-workbench/test-code-editors/general-purpose-editors']
	)
	assert.equal(
		(await client.category.getByPath({ query: { path: rootPath } })).category
			.projectCount,
		0
	)
	const oldParent = await http('/categories/' + parentPath + query)
	assert.equal(oldParent.response.status, 308)
	assert.equal(
		oldParent.response.headers.get('Location'),
		'/categories/test-workbench/test-code-editors' + query
	)
	checks.push(
		'Repeated admin ancestor rename/reparent: every historical descendant/parent redirects HTTP 308 in one hop, exact raw query including duplicate and unknown keys; canonical stays HTTP 200'
	)
	await checkpoint('renamed', {
		publishedSlug: publishedRow.slug,
		oldAiPath: aiPath,
		currentPath,
		query,
	})
	await writeFile(
		join(evidence, 'results.json'),
		JSON.stringify({ checks, passed: true }, null, 2),
		{ mode: 0o600 }
	)
	console.debug(JSON.stringify({ acceptance: 'passed', checks, evidence }))
} finally {
	const failures: Array<unknown> = []
	const attempt = async (step: () => Promise<unknown>) => {
		try {
			await step()
		} catch (error) {
			failures.push(error)
		}
	}
	try {
		// oxlint-disable-next-line unicorn/no-array-reverse -- ES2022 target; reverse a copy for cleanup.
		for (const child of [...processes].reverse()) {
			await attempt(() => stop(child))
		}
		for (const fixture of fixtures) await attempt(() => fixture.dispose())
		await attempt(() => database.close())
	} finally {
		await attempt(async () => {
			const { rm } = await import('node:fs/promises')
			if (assetCreated) await rm(assetPath, { force: true })
		})
	}
	// oxlint-disable-next-line no-unsafe-finally
	if (failures.length > 0) throw new AggregateError(failures, 'Cleanup failed')
	console.debug(
		'Acceptance fixtures and local servers cleaned; wrapper restores taxonomy-only database.'
	)
}
