export function isCategoryPath(path: string) {
	return /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,2}$/.test(
		path
	)
}
