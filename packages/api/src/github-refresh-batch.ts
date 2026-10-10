import { ORPCError } from '@orpc/server'
import { asc, eq } from 'drizzle-orm'

import { refreshProjectGithub } from '@altstack/api/github-refresh'

import type { db } from '@altstack/db'
import { project } from '@altstack/db/schemas'

export const GITHUB_REFRESH_LOCK = 'altstack.github-refresh'

export async function runGithubRefreshBatch(
	database: typeof db,
	options: {
		refresh?: typeof refreshProjectGithub
		log?: (event: Record<string, unknown>) => void
	} = {}
) {
	const refresh = options.refresh ?? refreshProjectGithub
	const log =
		options.log ??
		(() => {
			/* Optional sink for callers that do not need logs. */
		})
	const summary = {
		selected: 0,
		succeeded: 0,
		failed: 0,
		skipped: false,
		rateLimited: false,
	}
	// Session locks must stay on this dedicated connection for the entire batch.
	const lockClient = await database.$client.connect()
	let locked = false
	let lockFailure: Error | undefined
	const onLockError = (error: Error) => {
		lockFailure = error
	}
	lockClient.on('error', onLockError)
	try {
		const lock = await lockClient.query<{ locked: boolean }>(
			'SELECT pg_try_advisory_lock(hashtext($1), hashtext(current_database())) AS locked',
			[GITHUB_REFRESH_LOCK]
		)
		locked = lock.rows[0]?.locked === true
		if (!locked) {
			summary.skipped = true
			return summary
		}
		const projects = await database
			.select({ id: project.id })
			.from(project)
			.where(eq(project.status, 'published'))
			.orderBy(asc(project.id))
		summary.selected = projects.length
		for (const item of projects) {
			if (lockFailure) throw lockFailure
			try {
				await refresh(database, item.id)
				summary.succeeded += 1
				log({ event: 'github-refresh-success', projectId: item.id })
			} catch (error) {
				summary.failed += 1
				log({
					event: 'github-refresh-failure',
					projectId: item.id,
					code:
						error instanceof ORPCError ? error.code : 'INTERNAL_SERVER_ERROR',
				})
				if (error instanceof ORPCError && error.code === 'TOO_MANY_REQUESTS') {
					summary.rateLimited = true
					break
				}
			}
		}
		if (lockFailure) throw lockFailure
		return summary
	} finally {
		try {
			if (locked && !lockFailure) {
				await lockClient.query(
					'SELECT pg_advisory_unlock(hashtext($1), hashtext(current_database()))',
					[GITHUB_REFRESH_LOCK]
				)
			}
		} finally {
			lockClient.removeListener('error', onLockError)
			lockClient.release(true)
			log({ event: 'github-refresh-summary', ...summary })
		}
	}
}
