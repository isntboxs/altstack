import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { execFile } from 'node:child_process'
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, it } from 'vite-plus/test'

import {
	auditLog,
	project,
	projectClaim,
	projectMember,
	projectUpload,
	session,
	user,
} from '@altstack/db/schemas'

import { AUDIT_ACTIONS } from '@altstack/shared/constants'

import { connectTestPostgres } from './helpers/postgres'

it('expands management audit actions additively while preserving accounts, sessions and approved memberships', async () => {
	const postgres = await connectTestPostgres(),
		scope = await postgres.createSchema()
	const baseline = await mkdtemp(
		join(tmpdir(), 'altstack-member-audit-migration-')
	)
	try {
		const folder = fileURLToPath(new URL('../src/migrations', import.meta.url))
		for (const name of (await readdir(folder)).filter(
			(entry) => entry < '20261026115414_member-user-management'
		)) {
			await cp(join(folder, name), join(baseline, name), { recursive: true })
		}
		const options = {
			migrationsFolder: folder,
			migrationsSchema: scope.migrationsSchema,
		}
		await migrate(scope.db, { ...options, migrationsFolder: baseline })
		const [person] = await scope.db
			.insert(user)
			.values({
				name: 'Existing',
				email: 'existing@example.test',
				role: 'admin',
			})
			.returning()
		const [listing] = await scope.db
			.insert(project)
			.values({
				name: 'Existing',
				slug: 'existing',
				repositoryUrl: 'https://github.com/test/existing',
				status: 'published',
			})
			.returning()
		const [member] = await scope.db
			.insert(projectMember)
			.values({ projectId: listing!.id, userId: person!.id, role: 'owner' })
			.returning()
		const [login] = await scope.db
			.insert(session)
			.values({
				userId: person!.id,
				token: 'synthetic-preserved-session',
				updatedAt: new Date(),
				expiresAt: new Date(Date.now() + 60000),
			})
			.returning()
		const [event] = await scope.db
			.insert(auditLog)
			.values({
				actorId: person!.id,
				projectId: listing!.id,
				action: 'project_claim_approved',
			})
			.returning()
		await migrate(scope.db, options)
		await migrate(scope.db, options)
		expect(await scope.db.select().from(user)).toEqual([person])
		expect(await scope.db.select().from(session)).toEqual([login])
		expect(await scope.db.select().from(projectMember)).toEqual([member])
		expect(await scope.db.select().from(auditLog)).toEqual([event])
		await scope.db.insert(auditLog).values(
			AUDIT_ACTIONS.map((action) => {
				return { actorId: person!.id, projectId: listing!.id, action }
			})
		)
		await expect(
			scope.pool.query('INSERT INTO audit_log (action) VALUES ($1)', [
				'unsupported_action',
			])
		).rejects.toMatchObject({ code: '23514' })
		const constraintState = () =>
			scope.pool.query<{ convalidated: boolean }>(
				"SELECT convalidated FROM pg_constraint WHERE conrelid = 'audit_log'::regclass AND conname = 'audit_log_action_check'"
			)
		expect((await constraintState()).rows).toEqual([{ convalidated: false }])
		const validationUrl = new URL(scope.url)
		validationUrl.searchParams.set(
			'options',
			`${validationUrl.searchParams.get('options')} -c lock_timeout=1000`
		)
		const validate = () =>
			promisify(execFile)(
				'vp',
				['run', '--filter', '@altstack/db', 'db:validate-audit-actions'],
				{
					cwd: fileURLToPath(new URL('../../../', import.meta.url)),
					env: { ...process.env, DATABASE_URL: validationUrl.toString() },
					timeout: 15000,
				}
			)
		const writer = await scope.pool.connect()
		try {
			await writer.query('BEGIN')
			await writer.query('INSERT INTO audit_log (action) VALUES ($1)', [
				'project_updated',
			])
			// A separate backend must validate while a writer holds ROW EXCLUSIVE.
			// Reacquiring the migration's ACCESS EXCLUSIVE lock would time out.
			expect((await validate()).stdout).toContain(
				'Audit action constraint validated.'
			)
			expect((await constraintState()).rows).toEqual([{ convalidated: true }])
			expect((await validate()).stdout).toContain(
				'Audit action constraint validated.'
			)
		} finally {
			try {
				await writer.query('ROLLBACK')
			} finally {
				writer.release()
			}
		}
	} finally {
		await scope.close()
		await postgres.close()
		await rm(baseline, { recursive: true, force: true })
	}
}, 60000)

it('migrates existing listings additively without assigning owners and enforces scoped membership, valid roles and cascade cleanup', async () => {
	const postgres = await connectTestPostgres(),
		scope = await postgres.createSchema()
	const baseline = await mkdtemp(
		join(tmpdir(), 'altstack-ownership-migration-')
	)
	try {
		const folder = fileURLToPath(new URL('../src/migrations', import.meta.url))
		const names = (await readdir(folder)).toSorted()
		const added = names.find((name) => name.endsWith('_project-ownership'))!
		for (const name of names.filter((entry) => entry < added)) {
			await cp(join(folder, name), join(baseline, name), { recursive: true })
		}
		const options = {
			migrationsFolder: folder,
			migrationsSchema: scope.migrationsSchema,
		}
		await migrate(scope.db, { ...options, migrationsFolder: baseline })
		const [actor] = await scope.db
			.insert(user)
			.values({
				role: 'admin',
				name: 'Existing admin',
				email: 'admin@example.test',
			})
			.returning()
		const [listing] = await scope.db
			.insert(project)
			.values({
				name: 'Existing listing',
				slug: 'existing-listing',
				repositoryUrl: 'https://github.com/test/existing-listing',
				status: 'published',
				submitterId: actor!.id,
			})
			.returning()
		await migrate(scope.db, options)
		await migrate(scope.db, options)
		expect(await scope.db.select().from(project)).toEqual([listing])
		expect(await scope.db.select().from(user)).toEqual([actor])
		expect(await scope.db.select().from(projectMember)).toEqual([])
		await scope.db
			.insert(projectMember)
			.values({ projectId: listing!.id, userId: actor!.id, role: 'maintainer' })
		await expect(
			scope.db
				.insert(projectMember)
				.values({ projectId: listing!.id, userId: actor!.id, role: 'owner' })
		).rejects.toMatchObject({ cause: { code: '23505' } })
		await expect(
			scope.pool.query('UPDATE project_members SET role = $1', ['admin'])
		).rejects.toMatchObject({ code: '23514' })
		await scope.db.insert(projectClaim).values({
			projectId: listing!.id,
			userId: actor!.id,
			email: 'private@example.test',
			role: 'owner',
			status: 'email_pending',
			challengeId: actor!.id,
			codeExpiresAt: new Date(),
		})
		await scope.db.insert(projectUpload).values({
			key: 'tmp/logos/example-1.png',
			projectId: listing!.id,
			userId: actor!.id,
		})
		await scope.db.delete(user).where(eq(user.id, actor!.id))
		expect(await scope.db.select().from(projectMember)).toEqual([])
		expect(await scope.db.select().from(projectClaim)).toEqual([])
		expect(await scope.db.select().from(projectUpload)).toEqual([])
		expect((await scope.db.select().from(project))[0]!.submitterId).toBeNull()
	} finally {
		await scope.close()
		await postgres.close()
		await rm(baseline, { recursive: true, force: true })
	}
}, 60000)

it('adds nullable GitHub proof without inventing evidence or changing existing claims and members', async () => {
	const postgres = await connectTestPostgres(),
		scope = await postgres.createSchema()
	const baseline = await mkdtemp(
		join(tmpdir(), 'altstack-claim-github-migration-')
	)
	try {
		const folder = fileURLToPath(new URL('../src/migrations', import.meta.url))
		for (const name of (await readdir(folder)).filter(
			(entry) => entry < '20261024125455_claim-github-evidence'
		)) {
			await cp(join(folder, name), join(baseline, name), { recursive: true })
		}
		const options = {
			migrationsFolder: baseline,
			migrationsSchema: scope.migrationsSchema,
		}
		await migrate(scope.db, options)
		const [actor] = await scope.db
			.insert(user)
			.values({
				name: 'Existing representative',
				email: 'representative@example.test',
				role: 'maintainer',
			})
			.returning()
		const [listing] = await scope.db
			.insert(project)
			.values({
				name: 'Existing verified listing',
				slug: 'existing-verified',
				repositoryUrl: 'https://github.com/test/existing-verified',
				status: 'published',
			})
			.returning()
		await scope.db
			.insert(projectMember)
			.values({ projectId: listing!.id, userId: actor!.id, role: 'maintainer' })
		await scope.pool.query(
			'INSERT INTO project_claims (project_id,user_id,email,role,status,challenge_id,code_expires_at) VALUES ($1,$2,$3,$4,$5,$6,now())',
			[
				listing!.id,
				actor!.id,
				'contact@example.test',
				'maintainer',
				'approved',
				actor!.id,
			]
		)
		const before = (
			await scope.pool.query<Record<string, unknown>>(
				'SELECT * FROM project_claims'
			)
		).rows
		await migrate(scope.db, { ...options, migrationsFolder: folder })
		await migrate(scope.db, { ...options, migrationsFolder: folder })
		expect(
			(
				await scope.pool.query<Record<string, unknown>>(
					'SELECT * FROM project_claims'
				)
			).rows
		).toEqual(
			before.map((claim: Record<string, unknown>) => {
				return {
					...claim,
					github_evidence: null,
				}
			})
		)
		expect((await scope.db.select().from(projectMember))[0]).toMatchObject({
			projectId: listing!.id,
			userId: actor!.id,
			role: 'maintainer',
		})
	} finally {
		await scope.close()
		await postgres.close()
		await rm(baseline, { recursive: true, force: true })
	}
}, 60000)
