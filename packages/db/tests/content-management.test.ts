import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'

import { project, user } from '@altstack/db/schemas'

import { connectTestPostgres } from './helpers/postgres'

describe('content management migration', () => {
	it('preserves all legacy project statuses, media, metadata and assignments and sets deleted submitters to null', async () => {
		const postgres = await connectTestPostgres()
		const scope = await postgres.createSchema()
		const baseline = await mkdtemp(join(tmpdir(), 'altstack-content-baseline-'))
		try {
			const folder = fileURLToPath(
				new URL('../src/migrations', import.meta.url)
			)
			const migrations = (await readdir(folder)).toSorted()
			const latest = migrations.find((name) =>
				name.endsWith('_content-management')
			)
			if (!latest) throw new Error('Missing content management migration')
			for (const name of migrations.filter((entry) => entry < latest)) {
				await cp(join(folder, name), join(baseline, name), { recursive: true })
			}
			await migrate(scope.db, {
				migrationsFolder: baseline,
				migrationsSchema: scope.migrationsSchema,
			})
			await scope.pool.query(
				"INSERT INTO categories (slug, name) VALUES ('legacy-category', 'Legacy Category')"
			)
			for (const status of ['draft', 'published', 'rejected', 'removed']) {
				const {
					rows: [row],
				} = await scope.pool.query<{ id: string }>(
					"INSERT INTO projects (name, slug, tagline, description, logo, repository_url, status) VALUES ($1, $2, 'Existing tagline', 'Existing description', 'legacy/logo.svg', $3, $4) RETURNING id",
					[
						`Existing ${status}`,
						`existing-${status}`,
						`https://github.com/legacy/${status}`,
						status,
					]
				)
				if (!row) throw new Error('Missing fixture')
				await scope.pool.query(
					"INSERT INTO github_repositories (project_id, owner, repo, stars, forks, fetched_at) VALUES ($1, 'legacy', $2, 42, 3, '2026-01-01')",
					[row.id, status]
				)
				await scope.pool.query(
					"INSERT INTO project_categories (project_id, category_id) SELECT $1, id FROM categories WHERE slug = 'legacy-category'",
					[row.id]
				)
			}
			const before = (
				await scope.pool.query<Record<string, unknown>>(
					'SELECT * FROM projects ORDER BY slug'
				)
			).rows
			const metadata = (
				await scope.pool.query(
					'SELECT * FROM github_repositories ORDER BY repo'
				)
			).rows
			const assignments = (
				await scope.pool.query(
					'SELECT * FROM project_categories ORDER BY project_id'
				)
			).rows
			await migrate(scope.db, {
				migrationsFolder: folder,
				migrationsSchema: scope.migrationsSchema,
			})
			expect(
				(
					await scope.pool.query<Record<string, unknown>>(
						'SELECT * FROM projects ORDER BY slug'
					)
				).rows
			).toEqual(
				before.map((row) => {
					return { ...row, submitter_id: null, rejection_reason: null }
				})
			)
			expect(
				(
					await scope.pool.query(
						'SELECT * FROM github_repositories ORDER BY repo'
					)
				).rows
			).toEqual(metadata)
			expect(
				(
					await scope.pool.query(
						'SELECT * FROM project_categories ORDER BY project_id'
					)
				).rows
			).toEqual(assignments)
			const [submitter] = await scope.db
				.insert(user)
				.values({
					name: 'Submitter',
					email: 'submitter@example.com',
					role: 'user',
				})
				.returning()
			if (!submitter) throw new Error('Missing submitter')
			const [draft] = await scope.db
				.insert(project)
				.values({
					name: 'New draft',
					slug: 'new-draft',
					repositoryUrl: 'https://github.com/new/draft',
					status: 'draft',
					submitterId: submitter.id,
				})
				.returning()
			expect(draft).toMatchObject({
				tagline: null,
				description: null,
				logo: null,
				submitterId: submitter.id,
			})
			await scope.pool.query('DELETE FROM "user" WHERE id = $1', [submitter.id])
			expect(
				(
					await scope.pool.query(
						'SELECT submitter_id FROM projects WHERE slug = $1',
						['new-draft']
					)
				).rows
			).toEqual([{ submitter_id: null }])
		} finally {
			await scope.close()
			await postgres.close()
			await rm(baseline, { recursive: true, force: true })
		}
	}, 60_000)
})
