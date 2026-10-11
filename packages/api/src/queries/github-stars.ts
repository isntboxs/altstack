import type { githubStarsWindow } from '@altstack/shared/lib/github-stars'
import { githubCalendarDays } from '@altstack/shared/lib/github-stars'
import type { GithubStarsHistory } from '@altstack/shared/schemas/project'

export function buildGithubStarsHistory(
	window: ReturnType<typeof githubStarsWindow>,
	points: GithubStarsHistory['points']
): GithubStarsHistory {
	const first = points[0]
	const last = points.at(-1)
	const days = first && last ? githubCalendarDays(first.date, last.date) : 0
	const comparison =
		first && last && days > 0
			? {
					fromDate: first.date,
					toDate: last.date,
					days,
					deltaStars: last.stars - first.stars,
					deltaPercent:
						first.stars === 0
							? null
							: ((last.stars - first.stars) / first.stars) * 100,
				}
			: null
	return { ...window, points, comparison }
}
