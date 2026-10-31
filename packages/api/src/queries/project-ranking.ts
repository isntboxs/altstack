import type { SQLWrapper } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

import { projectIsVerified } from '@altstack/api/queries/ownership'

import { githubRepository } from '@altstack/db/schemas'

import { githubSnapshotDate } from '@altstack/shared/lib/github-stars'

export const PROJECT_RANKING = {
	starsWeight: 0.5,
	forksWeight: 0.5,
	starsReference: 10_000,
	forksReference: 1_000,
	ageHorizonDays: 5 * 365.25,
	minimumAgeFactor: 0.5,
	activityGraceDays: 90,
	inactivityHalfLifeDays: 180,
	verifiedBonus: 1.05,
	archivedFactor: 0.1,
} as const

export function recommendedProjectScore(now: Date) {
	const policy = PROJECT_RANKING
	// Match GitHub's snapshot calendar and hold time-based factors steady all day.
	const scoreDate = `${githubSnapshotDate(now)}T00:00:00+07:00`
	const daysSince = (date: SQLWrapper) =>
		sql`greatest(0.0, extract(epoch from (${scoreDate}::timestamptz - ${date})) / 86400.0)`
	const popularity = sql`(
		${policy.starsWeight} * ln(1.0 + greatest(${githubRepository.stars}, 0))
			/ ln(1.0 + ${policy.starsReference})
		+ ${policy.forksWeight} * ln(1.0 + greatest(${githubRepository.forks}, 0))
			/ ln(1.0 + ${policy.forksReference})
	)`
	const age = sql`case
		when ${githubRepository.repositoryCreatedAt} is null then 1.0
		else 1.0 - ${1 - policy.minimumAgeFactor}
			* least(1.0, ${daysSince(githubRepository.repositoryCreatedAt)} / ${policy.ageHorizonDays})
	end`
	const activity = sql`case
		when ${githubRepository.lastCommitAt} is not null then
			power(0.5, greatest(0.0,
				${daysSince(githubRepository.lastCommitAt)} - ${policy.activityGraceDays}
			) / ${policy.inactivityHalfLifeDays})
		when ${githubRepository.metadataFetchedAt} is not null then 0.0
		else 1.0
	end`

	return sql<number>`(
		${popularity} * (${age}) * (${activity})
		* (case when ${projectIsVerified} then ${policy.verifiedBonus} else 1.0 end)
		* (case when ${githubRepository.archived} is true then ${policy.archivedFactor} else 1.0 end)
	)`.mapWith(Number)
}
