const UNITS = [
	['day', 24 * 60 * 60],
	['hour', 60 * 60],
	['minute', 60],
	['second', 1],
] as const

// Explicit English and UTC keep SSR and hydration independent of host locale/TZ.
export function githubFullDate(date: Date) {
	return new Intl.DateTimeFormat('en-US', {
		dateStyle: 'full',
		timeStyle: 'long',
		timeZone: 'UTC',
	}).format(date)
}

export function githubElapsed(date: Date, now: number, relative = false) {
	const current = new Date(Math.max(date.getTime(), now))
	let months =
		(current.getUTCFullYear() - date.getUTCFullYear()) * 12 +
		current.getUTCMonth() -
		date.getUTCMonth()
	const anniversary = new Date(date)
	anniversary.setUTCDate(1)
	anniversary.setUTCMonth(date.getUTCMonth() + months)
	const lastDay = new Date(
		Date.UTC(anniversary.getUTCFullYear(), anniversary.getUTCMonth() + 1, 0)
	).getUTCDate()
	anniversary.setUTCDate(Math.min(date.getUTCDate(), lastDay))
	if (anniversary.getTime() > current.getTime()) months -= 1
	if (months >= 1) {
		const count = months >= 12 ? Math.floor(months / 12) : months
		const unit = months >= 12 ? 'year' : 'month'
		const elapsed = `${count} ${unit}${count === 1 ? '' : 's'}`
		return relative ? `${elapsed} ago` : elapsed
	}
	const seconds = Math.max(0, (now - date.getTime()) / 1_000)
	const [unit, duration] = UNITS.find(([, size]) => seconds >= size) ?? UNITS[3]
	const count = Math.floor(seconds / duration)
	const elapsed = `${count} ${unit}${count === 1 ? '' : 's'}`
	return relative ? `${elapsed} ago` : elapsed
}
