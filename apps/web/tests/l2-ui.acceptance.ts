// Disposable local runtime for collaborative-browser acceptance, never application data.
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Pool } from 'pg'

import { createAdminCategory } from '../../../packages/api/src/queries/category-integrity'
import { relations } from '../../../packages/db/src/relations'
import {
	githubRepository,
	project,
	projectCategory,
} from '../../../packages/db/src/schemas'

assert.equal(process.env.NODE_ENV, 'test', 'Run through test:scoped')
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
assert.match(
	(await pool.query<{ name: string }>('SELECT current_schema() AS name'))
		.rows[0].name,
	/^altstack_test_[a-f0-9]{32}$/
)
const db = drizzle({ client: pool, relations })
const workspace = resolve(import.meta.dirname, '../../..')
const evidence = resolve(workspace, '.l2-acceptance.local')
await mkdir(evidence, { recursive: true })
const stopFile = resolve(evidence, 'stop')
const children: Array<ReturnType<typeof spawn>> = []
const runtimeEnv = {
	...process.env,
	NODE_ENV: 'development',
	VITE_APP_NAME: 'AltStack',
	VITE_APP_URL: 'http://localhost:3420',
	VITE_SERVER_URL: 'http://localhost:3421',
	VITE_S3_PUBLIC_URL: 'http://localhost:3422/storage',
	BETTER_AUTH_URL: 'http://localhost:3421',
	CORS_ORIGINS: 'http://localhost:3420',
}
function start(
	command: string,
	args: Array<string>,
	cwd: string,
	name: string,
	extra: Record<string, string> = {}
) {
	const child = spawn(command, args, {
		cwd,
		env: { ...runtimeEnv, ...extra },
		detached: true,
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	const log = createWriteStream(resolve(evidence, name + '.log'), {
		mode: 0o600,
	})
	child.stdout.pipe(log)
	child.stderr.pipe(log)
	children.push(child)
	return child
}
const state = {
	delayMs: 0,
	fail: false,
	imageDelayMs: 0,
	requests: [] as Array<string>,
}
const cors = {
	'Access-Control-Allow-Origin': runtimeEnv.VITE_APP_URL,
	'Access-Control-Allow-Credentials': 'true',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	'Access-Control-Allow-Methods': 'GET, POST, QUERY, OPTIONS',
}
const proxy = Bun.serve({
	hostname: '127.0.0.1',
	port: 3421,
	async fetch(request) {
		const url = new URL(request.url)
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: cors })
		}
		if (url.pathname === '/__l2/control') {
			if (request.method === 'POST') {
				const control = (await request.json()) as Partial<typeof state> & {
					badgePublished?: boolean
				}
				if (control.badgePublished !== undefined) {
					await db
						.update(project)
						.set({ status: control.badgePublished ? 'published' : 'draft' })
						.where(eq(project.slug, 'l2-atlas'))
				}
				Object.assign(state, control)
			}
			return Response.json(state, { headers: cors })
		}
		// Mocked sessions exercise role-specific public menus only; the real RPC
		// server still authorizes independently. This is not provider/OAuth evidence.
		if (url.pathname === '/api/auth/get-session') {
			const role = request.headers
				.get('cookie')
				?.match(/l2-role=(user|admin)/)?.[1]
			const now = new Date().toISOString()
			return Response.json(
				role
					? {
							session: {
								id: 'local-fixture',
								userId: 'local-fixture',
								token: 'not-a-real-session',
								createdAt: now,
								updatedAt: now,
								expiresAt: new Date(Date.now() + 3600000).toISOString(),
							},
							user: {
								id: 'local-fixture',
								role,
								name: 'Local Fixture',
								email: 'fixture@example.test',
								emailVerified: true,
								image: null,
								createdAt: now,
								updatedAt: now,
							},
						}
					: null,
				{ headers: cors }
			)
		}
		state.requests.push(request.method + ' ' + url.pathname)
		if (url.pathname.startsWith('/api/rpc/project/')) {
			if (state.delayMs) await Bun.sleep(state.delayMs)
			if (state.fail) {
				return Response.json(
					{
						json: {
							defined: false,
							code: 'INTERNAL_SERVER_ERROR',
							status: 500,
							message: 'Controlled local outage',
						},
					},
					{ status: 500, headers: cors }
				)
			}
		}
		const response = await fetch(
			'http://127.0.0.1:3423' + url.pathname + url.search,
			{
				method: request.method,
				headers: request.headers,
				body: ['GET', 'HEAD'].includes(request.method)
					? undefined
					: await request.arrayBuffer(),
			}
		)
		const headers = new Headers(response.headers)
		for (const [key, value] of Object.entries(cors)) headers.set(key, value)
		return new Response(response.body, { status: response.status, headers })
	},
})
let embedHtml = ''
const assets = Bun.serve({
	hostname: '127.0.0.1',
	port: 3422,
	async fetch(request) {
		const url = new URL(request.url)
		if (url.pathname === '/embed') {
			if (request.method === 'POST') embedHtml = await request.text()
			return new Response(
				'<!doctype html><html lang="en"><meta charset="utf-8"><title>Separate origin embed fixture</title><body><h1>Copied AltStack badge</h1>' +
					embedHtml +
					'</body></html>',
				{
					headers: {
						'Content-Type': 'text/html; charset=utf-8',
						'Access-Control-Allow-Origin': runtimeEnv.VITE_APP_URL,
						'Access-Control-Allow-Methods': 'POST, GET',
					},
				}
			)
		}
		if (state.imageDelayMs) await Bun.sleep(state.imageDelayMs)
		if (url.pathname.endsWith('/logo.svg')) {
			return new Response(
				'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="16" fill="#111"/><path d="M20 48L40 20L60 48H48L40 35L32 48Z" fill="white"/></svg>',
				{ headers: { 'Content-Type': 'image/svg+xml' } }
			)
		}
		if (url.pathname.endsWith('/screenshot.svg')) {
			return new Response(
				'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#e8edf2"/><rect x="64" y="64" width="1152" height="592" rx="20" fill="white"/><text x="120" y="210" font-family="sans-serif" font-size="54" fill="#111">Atlas local fixture</text><text x="120" y="290" font-family="sans-serif" font-size="30" fill="#555">Stored screenshot for disposable acceptance</text></svg>',
				{ headers: { 'Content-Type': 'image/svg+xml' } }
			)
		}
		return new Response('Missing fixture image', { status: 404 })
	},
})
try {
	const leaf = await db.query.category.findFirst({ where: { slug: 'backend' } })
	assert.ok(leaf)
	const longCategory = await createAdminCategory(db, {
		name: 'VeryLongCategoryWithoutBreaks'.repeat(5),
		slug: 'l2-long-category',
		description: 'Synthetic long category for local acceptance.',
		parentId: null,
	})
	const cases = [
		{
			slug: 'l2-atlas',
			name: 'Atlas',
			screenshot: 'fixtures/screenshot.svg',
			websiteUrl: 'https://example.test/atlas',
			logo: 'fixtures/logo.svg',
		},
		{
			slug: 'l2-no-media',
			name: 'No Media',
			screenshot: null,
			websiteUrl: null,
			logo: '',
		},
		{
			slug: 'l2-website-only',
			name: 'Website Only',
			screenshot: null,
			websiteUrl: 'https://example.test/website-only',
			logo: 'fixtures/logo.svg',
		},
		{
			slug: 'l2-image-only',
			name: 'Image Only',
			screenshot: 'fixtures/screenshot.svg',
			websiteUrl: null,
			logo: 'fixtures/logo.svg',
		},
		{
			slug: 'l2-broken',
			name: 'Broken Media',
			screenshot: 'fixtures/broken.png',
			websiteUrl: 'https://example.test/broken',
			logo: 'fixtures/broken-logo.png',
		},
		{
			slug: 'l2-long',
			name: 'VeryLongProjectNameWithoutAnyBreaks'.repeat(4),
			screenshot: null,
			websiteUrl: 'javascript:alert(1)',
			logo: '',
		},
		...Array.from({ length: 20 }, (_, i) => {
			return {
				slug: `l2-pagination-${i}`,
				name: `Pagination Fixture ${i}`,
				screenshot: null,
				websiteUrl: null,
				logo: 'fixtures/logo.svg',
			}
		}),
	]
	for (const fixture of cases) {
		const [row] = await db
			.insert(project)
			.values({
				...fixture,
				status: 'published',
				tagline: 'Local open-source catalogue fixture.',
				description: 'Synthetic public copy for local UI acceptance.',
				repositoryUrl: 'https://github.com/altstack-fixtures/' + fixture.slug,
			})
			.returning()
		await db.insert(githubRepository).values({
			projectId: row.id,
			owner: 'altstack-fixtures',
			repo: fixture.slug,
			stars: 1234,
			forks: 99,
			fetchedAt: new Date(),
			metadataFetchedAt: null,
		})
		await db.insert(projectCategory).values({
			projectId: row.id,
			categoryId: fixture.slug === 'l2-long' ? longCategory.id : leaf.id,
		})
	}
	for (const status of ['draft', 'rejected', 'removed'] as const) {
		await db.insert(project).values({
			name: `PRIVATE_${status}`,
			slug: `l2-${status}`,
			status,
			rejectionReason: 'PRIVATE_FEEDBACK_SENTINEL',
			repositoryUrl: 'https://github.com/altstack-fixtures/' + status,
		})
	}
	start(
		'bun',
		['run', 'src/index.ts'],
		resolve(workspace, 'apps/server'),
		'api',
		{ PORT: '3423' }
	)
	start(
		'vp',
		['run', '--filter', 'web', 'dev', '--host', '127.0.0.1', '--port', '3420'],
		workspace,
		'web',
		{ PORT: '3420' }
	)
	await writeFile(
		resolve(evidence, 'runtime.json'),
		JSON.stringify(
			{
				origin: runtimeEnv.VITE_APP_URL,
				control: 'http://localhost:3421/__l2/control',
				cases: cases.map(({ slug }) => slug),
				schema: 'disposable (verified)',
				mockedSessions: true,
			},
			null,
			2
		)
	)
	process.stdout.write(
		'L2 disposable browser runtime: http://localhost:3420\nStop with .l2-acceptance.local/stop; wrapper then cleans the schema.\n'
	)
	for (;;) {
		try {
			await access(stopFile)
			break
		} catch {
			/* owned runtime remains available for browser QA */
		}
		if (children.some((child) => child.exitCode !== null)) {
			throw new Error('Runtime exited; inspect .l2-acceptance.local logs')
		}
		await Bun.sleep(1000)
	}
} finally {
	for (const child of children) {
		if (child.pid && child.exitCode === null) {
			process.kill(-child.pid, 'SIGTERM')
		}
	}
	await proxy.stop(true)
	await assets.stop(true)
	await pool.end()
}
