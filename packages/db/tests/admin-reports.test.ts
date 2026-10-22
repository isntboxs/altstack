import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vite-plus/test'

import { project, projectReport } from '@altstack/db/schemas'

import { connectTestPostgres } from './helpers/postgres'

it('migrates existing intake to Open without data loss, retains deleted-project reports and constrains status', async () => {
	const postgres = await connectTestPostgres()
	const scope = await postgres.createSchema()
	const baseline = await mkdtemp(join(tmpdir(), 'altstack-report-baseline-'))
	try {
		const folder = fileURLToPath(new URL('../src/migrations', import.meta.url))
		const migrations = (await readdir(folder)).toSorted()
		const latest = migrations.find((name) =>
			name.endsWith('_admin-report-inbox')
		)
		if (!latest) throw new Error('Missing report moderation migration')
		for (const name of migrations.filter((entry) => entry < latest)) {
			await cp(join(folder, name), join(baseline, name), { recursive: true })
		}
		const options = {
			migrationsFolder: folder,
			migrationsSchema: scope.migrationsSchema,
		}
		await migrate(scope.db, { ...options, migrationsFolder: baseline })
		const [target] = await scope.db
			.insert(project)
			.values({
				name: 'Existing project',
				slug: 'existing',
				repositoryUrl: 'https://github.com/test/existing',
				status: 'draft',
			})
			.returning()
		if (!target) throw new Error('Missing fixture')
		const old = (
			await scope.pool.query<{ id: string }>(
				`INSERT INTO project_reports (project_id, email, type, message) VALUES ($1, $2, 'other', $3) RETURNING *`,
				[target.id, 'legacy@example.test', 'Keep this private correction']
			)
		).rows[0]!
		await migrate(scope.db, options)
		await migrate(scope.db, options)
		expect(
			(
				await scope.pool.query('SELECT * FROM project_reports WHERE id = $1', [
					old.id,
				])
			).rows[0]
		).toEqual({ ...old, status: 'open' })
		expect(await scope.db.select().from(project)).toEqual([target])
		const [fresh] = await scope.db
			.insert(projectReport)
			.values({
				projectId: target.id,
				email: 'fresh@example.test',
				type: 'outdated',
			})
			.returning()
		expect(fresh?.status).toBe('open')
		await expect(
			scope.pool.query(
				`UPDATE project_reports SET status = 'pending' WHERE id = $1`,
				[old.id]
			)
		).rejects.toMatchObject({ code: '23514' })
		await expect(
			scope.pool.query(
				'UPDATE project_reports SET status = NULL WHERE id = $1',
				[old.id]
			)
		).rejects.toMatchObject({ code: '23502' })
		const indexes = (
			await scope.pool.query<{ indexname: string }>(
				'SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename = $2',
				[scope.migrationsSchema, 'project_reports']
			)
		).rows.map((row) => row.indexname)
		expect(indexes).toEqual(
			expect.arrayContaining([
				'project_reports_status_created_id_idx',
				'project_reports_created_id_idx',
			])
		)
		await scope.db.delete(project).where(eq(project.id, target.id))
		const retained = await scope.db.select().from(projectReport)
		expect(retained).toHaveLength(2)
		expect(retained.every((row) => row.projectId === null)).toBe(true)
	} finally {
		await scope.close()
		await postgres.close()
		await rm(baseline, { recursive: true, force: true })
	}
}, 60_000)
