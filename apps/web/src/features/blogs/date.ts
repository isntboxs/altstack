export function blogDate(date: Date) {
	return new Intl.DateTimeFormat('en-US', {
		dateStyle: 'long',
		timeZone: 'UTC',
	}).format(date)
}

export function blogTimestamp(publishedAt: Date, updatedAt: Date) {
	return updatedAt.getTime() > publishedAt.getTime()
		? { label: 'Updated', date: updatedAt }
		: { label: 'Published', date: publishedAt }
}
