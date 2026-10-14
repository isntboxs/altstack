import { eq, inArray, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { JSDOM } from 'jsdom'
// oxlint-disable import/no-relative-parent-imports -- Workspace acceptance fixture helpers.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createWriteStream } from 'node:fs'
import {
	cp,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rm,
	writeFile,
} from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

import {
	createAdminCategory,
	updateAdminCategory,
} from '../../../packages/api/src/queries/category-integrity'
import { relations } from '../../../packages/db/src/relations'
import {
	githubRepository,
	project,
	projectCategory,
} from '../../../packages/db/src/schemas'

// This process may only write inside the disposable schema owned by test:scoped.
assert.equal(process.env.NODE_ENV, 'test')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle({ client: pool, relations })
assert.match(
	(await pool.query<{ schema: string }>('SELECT current_schema() AS schema'))
		.rows[0].schema,
	/^altstack_test_[a-f0-9]{32}$/
)
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const evidence = await mkdtemp(join(homedir(), '.cache/', 'altstack-l1-http-'))
const runtime = join(evidence, 'runtime')
const canonicalOrigin = 'http://localhost:3410'
const origin = 'http://127.0.0.1:3410'
const env = {
	...process.env,
	VITE_APP_NAME: 'AltStack',
	VITE_APP_URL: canonicalOrigin,
	VITE_SERVER_URL: 'http://localhost:3411',
	VITE_S3_PUBLIC_URL: canonicalOrigin,
	CORS_ORIGINS: canonicalOrigin,
	BETTER_AUTH_URL: 'http://localhost:3411',
}
const children: Array<ReturnType<typeof spawn>> = []
const checks: Array<string> = []
let server: ReturnType<typeof spawn> | undefined

function start(
	command: string,
	args: Array<string>,
	cwd: string,
	name: string,
	production = false
) {
	const log = createWriteStream(join(evidence, `${name}.log`), { mode: 0o600 })
	const child = spawn(command, args, {
		cwd,
		env: {
			...env,
			...(production || name === 'build'
				? {
						NODE_ENV: 'production',
						PORT: name === 'api' ? '3411' : '3410',
						HOST: '127.0.0.1',
					}
				: {}),
		},
		detached: true,
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	child.stdout.pipe(log)
	child.stderr.pipe(log)
	children.push(child)
	return child
}
async function run(
	command: string,
	args: Array<string>,
	cwd: string,
	name: string
) {
	const child = start(command, args, cwd, name)
	await once(child, 'exit')
	const code = child.exitCode
	assert.equal(code, 0, `${name} failed; see ${evidence}`)
}
async function stop(child: ReturnType<typeof spawn>) {
	if (child.exitCode !== null || child.signalCode !== null || !child.pid) return
	const exited = once(child, 'exit')
	const stillRunning = () =>
		child.exitCode === null && child.signalCode === null
	process.kill(-child.pid, 'SIGTERM')
	await Promise.race([exited, new Promise((done) => setTimeout(done, 4000))])
	if (stillRunning()) {
		process.kill(-child.pid, 'SIGKILL')
		await exited
	}
}
async function ready() {
	for (let i = 0; i < 100; i++) {
		assert.equal(
			server?.exitCode,
			null,
			`Production server exited; see ${evidence}`
		)
		try {
			if ((await fetch(origin + '/robots.txt')).ok) return
		} catch {
			/* cold start */
		}
		await new Promise((done) => setTimeout(done, 200))
	}
	throw new Error(`Production server not ready; see ${evidence}`)
}
async function page(path: string, expected = 200) {
	const response = await fetch(origin + path, {
		redirect: 'manual',
		headers: { Host: 'untrusted.invalid' },
	})
	const html = await response.text()
	if (response.status !== expected) {
		await writeFile(join(evidence, 'failed-response.html'), html)
	}
	assert.equal(response.status, expected, `${path} status; see ${evidence}`)
	return { response, html, document: new JSDOM(html).window.document }
}
function meta(document: Document, key: string) {
	const matches = document.head.querySelectorAll(
		`meta[name="${key}"], meta[property="${key}"]`
	)
	assert.equal(matches.length, 1, `Exactly one ${key} tag`)
	return matches[0].getAttribute('content')!
}
function canonical(document: Document, path: string) {
	const tags = document.head.querySelectorAll('link[rel="canonical"]')
	assert.equal(tags.length, 1)
	assert.equal(tags[0].getAttribute('href'), canonicalOrigin + path)
}
function graph(document: Document) {
	const scripts = document.head.querySelectorAll(
		'script[type="application/ld+json"]'
	)
	assert.equal(scripts.length, 1)
	return JSON.parse(scripts[0].textContent) as {
		'@graph': Array<Record<string, unknown>>
	}
}
async function png(url: string, filename?: string) {
	assert.ok(url.startsWith(canonicalOrigin + '/'))
	const response = await fetch(url.replace(canonicalOrigin, origin))
	assert.equal(response.status, 200, `PNG ${url}`)
	assert.match(response.headers.get('content-type') ?? '', /^image\/png/)
	const bytes = Buffer.from(await response.arrayBuffer())
	assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
	assert.equal(bytes.readUInt32BE(16), 1200)
	assert.equal(bytes.readUInt32BE(20), 630)
	if (filename) await writeFile(join(evidence, filename), bytes)
	return { bytes, response }
}

try {
	const leaf = await createAdminCategory(db, {
		name: 'Backend',
		slug: 'test-l1-category',
		parentId: null,
		description: 'Synthetic category for L1 HTTP acceptance.',
	})
	const publicCopy =
		'Public & "quoted" software </script><script>privateSentinel()</script>'
	const [published] = await db
		.insert(project)
		.values({
			name: 'Synthetic Atlas',
			slug: 'test-l1-atlas',
			status: 'published',
			tagline: 'A practical open-source workspace.',
			description: publicCopy,
			logo: 'brand/altstack-symbol.svg',
			repositoryUrl: 'https://github.com/altstack-test-fixtures/l1-atlas',
			content:
				'# Getting started\n\nCrawler-readable documentation.\n\n- Install locally\n- Read the [source](https://github.com/altstack-test-fixtures/l1-atlas)\n\n<script>privateSentinel()</script>\n\n[unsafe](javascript:alert(1))',
			rejectionReason: 'PRIVATE_REJECTION_SENTINEL',
		})
		.returning()
	assert.ok(published)
	await db.insert(githubRepository).values({
		projectId: published.id,
		owner: 'altstack-test-fixtures',
		repo: 'l1-atlas',
		fetchedAt: new Date(),
	})
	await db
		.insert(projectCategory)
		.values({ projectId: published.id, categoryId: leaf.id })
	const auxiliary = await db
		.insert(project)
		.values(
			Array.from({ length: 12 }, (_, index) => {
				return {
					name: `Synthetic pagination ${index}`,
					slug: `test-l1-pagination-${index}`,
					status: 'published' as const,
					tagline: 'Synthetic public pagination fixture.',
					description: 'Only for disposable-schema acceptance.',
					logo: 'brand/altstack-symbol.svg',
					repositoryUrl: `https://github.com/altstack-test-fixtures/l1-pagination-${index}`,
				}
			})
		)
		.returning({ id: project.id })
	await db.insert(githubRepository).values(
		auxiliary.map((item, index) => {
			return {
				projectId: item.id,
				owner: 'altstack-test-fixtures',
				repo: `l1-pagination-${index}`,
				fetchedAt: new Date(),
			}
		})
	)
	const hidden: Array<{ id: string; slug: string }> = []
	for (const status of ['draft', 'rejected', 'removed'] as const) {
		const [row] = await db
			.insert(project)
			.values({
				name: `PRIVATE_${status}_SENTINEL`,
				slug: `test-l1-${status}`,
				status,
				repositoryUrl: `https://github.com/altstack-test-fixtures/l1-${status}`,
				rejectionReason: 'PRIVATE_REJECTION_SENTINEL',
			})
			.returning()
		assert.ok(row)
		await db.insert(githubRepository).values({
			projectId: row.id,
			owner: 'altstack-test-fixtures',
			repo: `l1-${status}`,
			fetchedAt: new Date(),
		})
		hidden.push(row)
	}
	if (!process.argv.includes('--skip-build')) {
		await run('vp', ['run', '-r', 'build'], workspace, 'build')
	}
	await mkdir(runtime)
	// Reproduce Docker's prod-only hoisted installation, with no source checkout.
	await cp(join(workspace, 'bun.lock'), join(runtime, 'bun.lock'))
	await cp(join(workspace, 'package.json'), join(runtime, 'package.json'))
	for (const group of ['apps', 'packages', 'tools']) {
		for (const entry of await readdir(join(workspace, group), {
			withFileTypes: true,
		}).catch(() => [])) {
			if (!entry.isDirectory()) continue
			const destination = join(runtime, group, entry.name)
			await mkdir(destination, { recursive: true })
			await cp(
				join(workspace, group, entry.name, 'package.json'),
				join(destination, 'package.json')
			).catch(() => {
				/* Non-package directories have no manifest. */
			})
		}
	}
	await run(
		'vp',
		[
			'install',
			'--frozen-lockfile',
			'--prod',
			'--ignore-scripts',
			'--',
			'--linker',
			'hoisted',
		],
		runtime,
		'install-production'
	)
	await cp(join(workspace, 'apps/web/.output'), join(runtime, '.output'), {
		recursive: true,
	})
	await writeFile(
		join(runtime, 'network-guard.mjs'),
		'const original = globalThis.fetch; globalThis.fetch = (input, init) => { const url = new URL(typeof input === "string" ? input : input.url ?? input); if (url.protocol === "data:" || url.origin === "http://localhost:3411") return original(input, init); throw new Error("Unexpected outbound HTTP from production SSR/OG"); };\n'
	)
	start(
		'bun',
		['run', 'src/index.ts'],
		join(workspace, 'apps/server'),
		'api',
		true
	)
	await new Promise((done) => setTimeout(done, 2000))
	server = start(
		'node',
		['--import', './network-guard.mjs', '.output/server/index.mjs'],
		runtime,
		'node',
		true
	)
	await ready()
	checks.push(
		'Cold Node production startup from only output + prod dependencies; outbound HTTP restricted to local auth API'
	)
	const home = await page('/')
	canonical(home.document, '/')
	assert.match(home.document.title, /^AltStack/)
	assert.match(meta(home.document, 'robots'), /^index/)
	assert.equal(meta(home.document, 'twitter:card'), 'summary_large_image')
	assert.equal(meta(home.document, 'og:url'), canonicalOrigin + '/')
	assert.equal(meta(home.document, 'og:image:width'), '1200')
	assert.equal(meta(home.document, 'og:image:height'), '630')
	assert.equal(meta(home.document, 'og:image:type'), 'image/png')
	assert.ok(meta(home.document, 'og:image:alt'))
	await png(meta(home.document, 'og:image'), 'default.png')
	assert.ok(
		graph(home.document)['@graph'].some(
			(entity) => entity['@type'] === 'WebSite'
		)
	)
	assert.match(home.response.headers.get('cache-control') ?? '', /no-store/)
	checks.push(
		'SSR home metadata is unique, canonical uses configured origin despite hostile Host, deployed static PNG is fetchable'
	)
	for (const query of [
		'?q=Atlas',
		'?category=backend',
		'?sort=name&page=2',
		'?q=Atlas&category=backend&sort=most-stars&page=1',
	]) {
		const filtered = await page('/' + query)
		canonical(filtered.document, '/')
		assert.match(meta(filtered.document, 'robots'), /^noindex/)
	}
	const paginated = await page('/?page=2')
	canonical(paginated.document, '/?page=2')
	assert.match(meta(paginated.document, 'robots'), /^index/)
	const outOfRange = await page('/?page=999')
	canonical(outOfRange.document, '/?page=999')
	assert.match(meta(outOfRange.document, 'robots'), /^noindex/)
	const tracked = await page('/?utm_source=fixture')
	canonical(tracked.document, '/')
	assert.match(meta(tracked.document, 'robots'), /^index/)
	checks.push(
		'Search/category/sort permutations noindex, clean canonical; pure pagination self-canonical; tracking stripped'
	)
	const detail = await page('/' + published.slug)
	await writeFile(join(evidence, 'project.html'), detail.html)
	canonical(detail.document, '/' + published.slug)
	assert.match(detail.document.title, /^Synthetic Atlas — A practical/)
	assert.equal(meta(detail.document, 'description'), publicCopy)
	assert.equal(meta(detail.document, 'og:description'), publicCopy)
	assert.equal(meta(detail.document, 'twitter:description'), publicCopy)
	const entities = graph(detail.document)['@graph']
	const software = entities.find(
		(entity) => entity['@type'] === 'SoftwareSourceCode'
	)
	assert.ok(software)
	assert.equal(software.name, published.name)
	assert.equal(software.description, publicCopy)
	assert.equal(software.codeRepository, published.repositoryUrl)
	assert.equal(
		detail.document.querySelectorAll('script:not([src])').length > 0,
		true
	)
	assert.ok(!detail.html.includes('</script><script>privateSentinel()'))
	const content = detail.document.querySelector(
		'article[aria-label="Project documentation"]'
	)
	assert.ok(content)
	assert.ok(content.textContent.includes('Crawler-readable documentation.'))
	assert.equal(content.querySelector('h1'), null)
	assert.equal(content.querySelector('script'), null)
	assert.equal(content.querySelector('a[href^="javascript:"]'), null)
	assert.ok(!detail.html.includes('PRIVATE_REJECTION_SENTINEL'))
	const imageUrl = meta(detail.document, 'og:image')
	assert.ok(imageUrl.includes(`/og/project/${published.id}?v=`))
	const firstImage = await png(imageUrl, 'project.png')
	assert.equal(firstImage.response.headers.get('cache-control'), 'no-store')
	assert.ok(
		(
			await png(
				imageUrl + '&title=PRIVATE_OVERRIDE&image=http%3A%2F%2F169.254.169.254'
			)
		).bytes.equals(firstImage.bytes)
	)
	assert.ok(
		!firstImage.bytes.equals((await png(meta(home.document, 'og:image'))).bytes)
	)
	checks.push(
		'SSR project metadata/JSON-LD use real public data, escape script terminators, documentation is readable without JavaScript, dynamic PNG is content-specific'
	)
	const categoryPage = await page('/categories/test-l1-category')
	canonical(categoryPage.document, '/categories/test-l1-category')
	assert.equal(
		graph(categoryPage.document)['@graph'].at(-1)?.['@type'],
		'CollectionPage'
	)
	const categoryUrl = meta(categoryPage.document, 'og:image')
	const categoryPng = await png(categoryUrl, 'category.png')
	assert.ok(!categoryPng.bytes.equals(firstImage.bytes))
	const categoryFiltered = await page(
		'/categories/test-l1-category?q=Atlas&sort=name'
	)
	canonical(categoryFiltered.document, '/categories/test-l1-category')
	assert.match(meta(categoryFiltered.document, 'robots'), /^noindex/)
	await updateAdminCategory(db, {
		id: leaf.id,
		name: 'Backend & infrastructure',
		slug: 'test-l1-backend',
		description: 'Public category copy <safe> & useful.',
	})
	const old = await page(
		'/categories/test-l1-category?q=Atlas&sort=name&campaign=a%20b&campaign=c',
		308
	)
	assert.equal(
		old.response.headers.get('location'),
		'/categories/test-l1-backend?q=Atlas&sort=name&campaign=a%20b&campaign=c'
	)
	const renamed = await page('/categories/test-l1-backend')
	canonical(renamed.document, '/categories/test-l1-backend')
	assert.notEqual(meta(renamed.document, 'og:image'), categoryUrl)
	assert.ok(!(await png(categoryUrl)).bytes.equals(categoryPng.bytes))
	checks.push(
		'Category cards are distinct and refresh after rename; historical category paths keep one-hop 308 and exact query'
	)
	for (const item of hidden) {
		const missing = await page('/' + item.slug, 404)
		assert.match(meta(missing.document, 'robots'), /^noindex/)
		assert.equal(missing.document.querySelector('link[rel="canonical"]'), null)
		assert.ok(!missing.html.includes('PRIVATE_'))
		const image = await fetch(origin + '/og/project/' + item.id)
		assert.equal(image.status, 404)
		assert.equal(await image.text(), 'Not found')
	}
	for (const path of [
		'/og/project/invalid',
		'/og/project/00000000-0000-0000-0000-000000000000',
		'/og/category/invalid',
		'/og/category/00000000-0000-0000-0000-000000000000',
	]) {
		const response = await fetch(origin + path)
		assert.equal(response.status, 404)
		assert.equal(await response.text(), 'Not found')
		assert.equal(response.headers.get('cache-control'), 'no-store')
	}
	for (const path of [
		'/auth/sign-in?returnTo=%2Fsubmission',
		'/submit',
		'/submission',
		'/projects',
		'/admin/categories',
	]) {
		const response = await fetch(origin + path, { redirect: 'manual' })
		assert.match(response.headers.get('x-robots-tag') ?? '', /noindex/)
		if (response.status === 200) {
			assert.match(
				meta(new JSDOM(await response.text()).window.document, 'robots'),
				/^noindex/
			)
		}
	}
	checks.push(
		'Draft/rejected/removed and invalid IDs return generic 404 without private data; auth/private/admin responses carry noindex'
	)
	const index = await page('/sitemap.xml')
	assert.match(
		index.response.headers.get('content-type') ?? '',
		/application\/xml/
	)
	const sitemap = new JSDOM(index.html, { contentType: 'application/xml' })
		.window.document
	assert.equal(sitemap.querySelector('parsererror'), null)
	const locations = [...sitemap.querySelectorAll('loc')].map(
		(loc) => loc.textContent
	)
	assert.ok(locations.includes(canonicalOrigin + '/sitemaps/projects/1'))
	const projects = await page('/sitemaps/projects/1')
	assert.ok(projects.html.includes('/' + published.slug))
	assert.match(projects.html, /<lastmod>\d{4}-\d{2}-\d{2}T/)
	assert.ok(!projects.html.includes('PRIVATE_'))
	for (const item of hidden) assert.ok(!projects.html.includes(item.slug))
	const pages = await page('/sitemaps/pages.xml')
	assert.ok(pages.html.includes('/categories/test-l1-backend'))
	assert.ok(!pages.html.includes('/categories/test-l1-category<'))
	assert.ok(!pages.html.includes('/projects<'))
	const robots = await page('/robots.txt')
	assert.match(robots.html, /Allow: \/og\//)
	assert.ok(robots.html.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`))
	checks.push(
		'XML sitemap index/shards have configured-origin canonical published pages, valid dates, MIME and category moves; robots discovers sitemap and allows OG'
	)
	await db
		.update(project)
		.set({
			name: 'Changed public project',
			tagline: 'Updated content is visible.',
			updatedAt: new Date(),
		})
		.where(eq(project.id, published.id))
	const changed = await page('/' + published.slug)
	assert.notEqual(meta(changed.document, 'og:image'), imageUrl)
	assert.ok(
		!(await png(imageUrl, 'project-updated.png')).bytes.equals(firstImage.bytes)
	)
	await db
		.update(project)
		.set({ name: 'W'.repeat(200), tagline: null, description: null })
		.where(eq(project.id, published.id))
	await png(imageUrl, 'project-long.png')
	await db
		.update(project)
		.set({
			name: '工具 🚀',
			tagline: 'Εργαλεία — Программное обеспечение — café',
			description: null,
			logo: 'http://169.254.169.254/ignored',
		})
		.where(eq(project.id, published.id))
	await png(imageUrl, 'project-unicode.png')
	await stop(server)
	server = start(
		'node',
		['--import', './network-guard.mjs', '.output/server/index.mjs'],
		runtime,
		'node-restart',
		true
	)
	await ready()
	await png(imageUrl, 'project-cold.png')
	await db
		.update(project)
		.set({ status: 'draft' })
		.where(eq(project.id, published.id))
	assert.equal(
		(await fetch(imageUrl.replace(canonicalOrigin, origin))).status,
		404
	)
	await page('/' + published.slug, 404)
	assert.ok(!(await page('/sitemaps/projects/1')).html.includes(published.slug))
	assert.ok(
		!(await page('/sitemaps/pages.xml')).html.includes(
			'/categories/test-l1-backend'
		)
	)
	const emptyCategory = await page('/categories/test-l1-backend')
	assert.match(meta(emptyCategory.document, 'robots'), /^noindex/)
	await png(meta(emptyCategory.document, 'og:image'), 'category-empty.png')
	await db.delete(project).where(eq(project.id, published.id))
	assert.equal(
		(await fetch(imageUrl.replace(canonicalOrigin, origin))).status,
		404
	)
	checks.push(
		'Live changes refresh image bytes/revisions; unpublish/delete immediately remove image/detail/sitemap visibility even with old URL; long/missing/Unicode fields and cold restart work offline'
	)
	// Simulate a data failure only in this disposable schema, then restore it.
	await db.execute(sql`ALTER TABLE projects RENAME TO projects_l1_unavailable`)
	try {
		const imageFailure = await fetch(imageUrl.replace(canonicalOrigin, origin))
		assert.equal(imageFailure.status, 503)
		assert.equal(imageFailure.headers.get('cache-control'), 'no-store')
		assert.equal(await imageFailure.text(), 'Image temporarily unavailable')
		const mapFailure = await page('/sitemap.xml', 503)
		assert.equal(mapFailure.html, 'Sitemap temporarily unavailable')
		const errorPage = await page('/' + published.slug, 500)
		assert.match(meta(errorPage.document, 'robots'), /^noindex/)
		assert.equal(
			errorPage.document.querySelector('link[rel="canonical"]'),
			null
		)
		assert.ok(!errorPage.html.includes('PRIVATE_'))
	} finally {
		await db.execute(
			sql`ALTER TABLE projects_l1_unavailable RENAME TO projects`
		)
	}
	checks.push(
		'Transient DB failures return generic no-store 503 for OG/sitemap and noindex SSR error metadata without private data'
	)
	await db.delete(project).where(
		inArray(
			project.id,
			auxiliary.map((item) => item.id)
		)
	)
	const files = await readdir(join(runtime, '.output/public/assets'))
	for (const filename of files.filter((name) => name.endsWith('.js'))) {
		const js = await readFile(
			join(runtime, '.output/public/assets', filename),
			'utf8'
		)
		assert.ok(
			!/resvg\.wasm|@vercel\/og|inter-400\.ttf|inter-500\.ttf|Geist-Regular\.ttf/.test(
				js
			),
			`Renderer leaked to client: ${filename}`
		)
	}
	checks.push('Renderer, WASM and OG font data remain outside client JS')
	await writeFile(
		join(evidence, 'results.json'),
		JSON.stringify({ passed: true, checks }, null, 2)
	)
	console.debug(
		JSON.stringify({
			acceptance: 'L1',
			passed: checks.length,
			evidence,
			checks,
		})
	)
	if (process.argv.includes('--preview')) {
		await db.insert(project).values({
			id: published.id,
			name: 'Synthetic Atlas',
			slug: published.slug,
			status: 'published',
			tagline: published.tagline,
			description: 'Synthetic preview fixture for the L1 acceptance checks.',
			logo: 'brand/altstack-symbol.svg',
			repositoryUrl: published.repositoryUrl,
			content: '# Getting started\n\nCrawler-readable documentation.',
		})
		await db.insert(githubRepository).values({
			projectId: published.id,
			owner: 'altstack-test-fixtures',
			repo: 'l1-atlas',
			fetchedAt: new Date(),
		})
		await db
			.insert(projectCategory)
			.values({ projectId: published.id, categoryId: leaf.id })
		console.debug(
			JSON.stringify({
				previewSlug: published.slug,
				categoryPath: 'test-l1-backend',
			})
		)
		console.debug(
			'Production preview ready on port 3410; write preview-done in evidence directory to finish.'
		)
		for (let i = 0; i < 1200; i++) {
			if (
				await readFile(join(evidence, 'preview-done'))
					.then(() => true)
					.catch(() => false)
			) {
				break
			}
			await new Promise((done) => setTimeout(done, 1000))
		}
	}
} finally {
	// oxlint-disable-next-line unicorn/no-array-reverse -- ES2022 project target.
	for (const child of [...children].reverse()) await stop(child)
	await pool.end()
	await rm(runtime, { recursive: true, force: true })
}
