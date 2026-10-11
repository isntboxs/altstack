export const GITHUB_HISTORY_TIMEZONE = 'Asia/Jakarta'
const DAY_MS = 86_400_000
const dateFormatter = new Intl.DateTimeFormat('en-US', {
	timeZone: GITHUB_HISTORY_TIMEZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
})

export function githubSnapshotDate(instant: Date) {
	const parts = dateFormatter.formatToParts(instant)
	return ['year', 'month', 'day']
		.map((type) => parts.find((part) => part.type === type)?.value)
		.join('-')
}

// Date-only arithmetic is independent of the process and browser timezone.
export function shiftGithubDate(date: string, days: number) {
	return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
		.toISOString()
		.slice(0, 10)
}

export function githubCalendarDays(from: string, to: string) {
	return (
		(Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS
	)
}

export function githubStarsWindow(now: Date) {
	const windowEndDate = githubSnapshotDate(now)
	return {
		timezone: GITHUB_HISTORY_TIMEZONE,
		windowStartDate: shiftGithubDate(windowEndDate, -30),
		windowEndDate,
	} as const
}
