import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vite-plus/test'

import { bookmark, project, user } from '@altstack/db/schemas'

import { connectTestPostgres } from './helpers/postgres'

it('adds bookmarks to existing data, reruns safely and enforces uniqueness, indexes, relations and cascading cleanup', async () => {
	const postgres = await connectTestPostgres()
	const scope = await postgres.createSchema()
	const baseline = await mkdtemp(join(tmpdir(), 'altstack-bookmarks-baseline-'))
	try {
		const folder = fileURLToPath(new URL('../src/migrations', import.meta.url))
		const migrations = (await readdir(folder)).toSorted()
		const latest = migrations.find((name) => name.endsWith('_bookmarks'))
		if (!latest) throw new Error('Missing bookmarks migration')
		for (const name of migrations.filter((entry) => entry < latest)) {
			await cp(join(folder, name), join(baseline, name), { recursive: true })
		}
		const options = {
			migrationsFolder: folder,
			migrationsSchema: scope.migrationsSchema,
		}
		await migrate(scope.db, { ...options, migrationsFolder: baseline })
		const [owner] = await scope.db
			.insert(user)
			.values({
				name: 'Existing account',
				email: 'existing@bookmark.test',
				role: 'user',
			})
			.returning()
		const [existing] = await scope.db
			.insert(project)
			.values({
				name: 'Existing project',
				slug: 'existing',
				tagline: 'Keep this tagline',
				repositoryUrl: 'https://github.com/bookmark/existing',
				status: 'published',
			})
			.returning()
		if (!owner || !existing) throw new Error('Missing fixture')
		await migrate(scope.db, options)
		await migrate(scope.db, options)
		expect(await scope.db.select().from(project)).toEqual([existing])
		expect(await scope.db.select().from(user)).toEqual([owner])
		const value = { userId: owner.id, projectId: existing.id }
		await scope.db.insert(bookmark).values(value)
		await expect(scope.db.insert(bookmark).values(value)).rejects.toMatchObject(
			{ cause: { code: '23505' } }
		)
		await expect(
			scope.pool.query('INSERT INTO bookmarks (project_id) VALUES ($1)', [
				existing.id,
			])
		).rejects.toMatchObject({ code: '23502' })
		const related = await scope.db.query.user.findFirst({
			where: { id: owner.id },
			with: { bookmarks: { with: { project: true } } },
		})
		expect(related?.bookmarks[0]?.project).toEqual(existing)
		const indexes = (
			await scope.pool.query<{ indexname: string }>(
				'SELECT indexname FROM pg_indexes WHERE schemaname = $1 AND tablename = $2',
				[scope.migrationsSchema, 'bookmarks']
			)
		).rows.map((row) => row.indexname)
		expect(indexes).toEqual(
			expect.arrayContaining([
				'bookmarks_pkey',
				'bookmarks_user_created_idx',
				'bookmarks_project_idx',
			])
		)
		await scope.db.delete(user).where(eq(user.id, owner.id))
		expect(await scope.db.select().from(bookmark)).toEqual([])
		expect(await scope.db.select().from(project)).toEqual([existing])
	} finally {
		await scope.close()
		await postgres.close()
		await rm(baseline, { recursive: true, force: true })
	}
}, 60_000)
