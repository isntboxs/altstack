import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vite-plus/test'

import {
	auditLog,
	project,
	reviewNotification,
	user,
} from '@altstack/db/schemas'

import { connectTestPostgres } from './helpers/postgres'

it('adds a private outbox without historical backfill, preserves data on rerun and constrains/cascades event identities', async () => {
	const postgres = await connectTestPostgres()
	const scope = await postgres.createSchema()
	const baseline = await mkdtemp(join(tmpdir(), 'altstack-review-baseline-'))
	try {
		const folder = fileURLToPath(new URL('../src/migrations', import.meta.url))
		const migrations = (await readdir(folder)).toSorted()
		const latest = migrations.find((name) =>
			name.endsWith('_submission-review-notifications')
		)
		if (!latest) throw new Error('Missing review notification migration')
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
				name: 'Legacy owner',
				email: 'legacy@example.test',
				role: 'user',
			})
			.returning()
		const [existing] = await scope.db
			.insert(project)
			.values({
				name: 'Legacy project',
				slug: 'legacy',
				repositoryUrl: 'https://github.com/test/legacy',
				status: 'rejected',
				rejectionReason: 'Legacy feedback',
				submitterId: owner!.id,
			})
			.returning()
		const [decision] = await scope.db
			.insert(auditLog)
			.values({
				projectId: existing!.id,
				actorId: owner!.id,
				action: 'project_status_changed',
				reason: 'Legacy feedback',
				metadata: { fromStatus: 'draft', toStatus: 'rejected' },
			})
			.returning()
		await migrate(scope.db, options)
		await migrate(scope.db, options)
		expect(await scope.db.select().from(project)).toEqual([existing])
		expect(await scope.db.select().from(user)).toEqual([owner])
		expect(await scope.db.select().from(auditLog)).toEqual([decision])
		expect(await scope.db.select().from(reviewNotification)).toEqual([])
		const value = {
			id: decision!.id,
			projectId: existing!.id,
			recipientId: owner!.id,
			projectName: existing!.name,
			projectSlug: existing!.slug,
			outcome: 'rejected' as const,
			rejectionReason: 'Useful feedback',
		}
		await scope.db.insert(reviewNotification).values(value)
		await expect(
			scope.db.insert(reviewNotification).values(value)
		).rejects.toMatchObject({ cause: { code: '23505' } })
		for (const patch of [
			{ outcome: 'draft' },
			{ status: 'unknown' },
			{ attempts: -1 },
			{ rejectionReason: ' ' },
			{ rejectionReason: null },
		]) {
			const column = Object.keys(patch)[0]!
			await expect(
				scope.pool.query(
					`UPDATE submission_review_notifications SET "${column === 'rejectionReason' ? 'rejection_reason' : column}" = $1`,
					[Object.values(patch)[0]]
				)
			).rejects.toMatchObject({ code: '23514' })
		}
		const indexes = await scope.pool.query<{ indexdef: string }>(
			'SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = $2',
			[scope.migrationsSchema, 'review_notifications_due_idx']
		)
		expect(indexes.rows[0]!.indexdef).toContain(
			"WHERE (status = 'pending'::text)"
		)
		await scope.db.delete(user).where(eq(user.id, owner!.id))
		expect(await scope.db.select().from(reviewNotification)).toEqual([])
		expect((await scope.db.select().from(project))[0]).toMatchObject({
			id: existing!.id,
			status: 'rejected',
			submitterId: null,
		})
	} finally {
		await scope.close()
		await postgres.close()
		await rm(baseline, { recursive: true, force: true })
	}
}, 60_000)
