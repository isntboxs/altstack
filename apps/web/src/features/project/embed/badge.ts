import { publicUrl } from '#/features/seo/meta'

export const badgeDefaults = { theme: 'dark', width: 200, height: 50 } as const
export const badgeLimits = {
	width: { min: 160, max: 1200 },
	height: { min: 40, max: 400 },
} as const
export type BadgeTheme = 'dark' | 'light'
export type BadgeOptions = { theme: BadgeTheme; width: number; height: number }

// Strict decimal integers: do not coerce blanks, fractions, exponents or infinity.
export function badgeDimension(value: unknown, dimension: 'width' | 'height') {
	if (typeof value !== 'string' || !/^\d{1,4}$/.test(value)) return null
	const number = Number(value)
	const { min, max } = badgeLimits[dimension]
	return Number.isSafeInteger(number) && number >= min && number <= max
		? number
		: null
}

export function badgeParameters(params: URLSearchParams): BadgeOptions | null {
	for (const key of ['theme', 'width', 'height']) {
		if (params.getAll(key).length > 1) return null
	}
	const theme = params.get('theme') ?? badgeDefaults.theme
	const width = badgeDimension(params.get('width') ?? '200', 'width')
	const height = badgeDimension(params.get('height') ?? '50', 'height')
	return (theme === 'dark' || theme === 'light') && width && height
		? { theme, width, height }
		: null
}

export function escapeAttribute(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
}

export function badgeUrl(slug: string, options: BadgeOptions) {
	const query = new URLSearchParams({
		theme: options.theme,
		width: String(options.width),
		height: String(options.height),
	})
	return publicUrl(`/${encodeURIComponent(slug)}/badge.svg?${query}`)
}

export function badgeSnippet(
	slug: string,
	name: string,
	options: BadgeOptions
) {
	const link = new URL(publicUrl(`/${encodeURIComponent(slug)}`))
	link.search = new URLSearchParams({
		utm_source: 'altstack',
		utm_medium: 'badge',
		utm_campaign: 'embed',
		utm_content: `project-${slug}`,
	}).toString()
	return `<a href="${escapeAttribute(link.href)}" target="_blank" rel="noopener noreferrer">\n  <img src="${escapeAttribute(badgeUrl(slug, options))}" width="${options.width}" height="${options.height}" alt="${escapeAttribute(name)} badge" loading="lazy" />\n</a>`
}

// One discriminator keeps project dialogs mutually exclusive.
export function projectDialogSearch(
	search: Record<string, unknown>
): Record<string, unknown> & { dialog?: 'embed' | 'report' | 'verify' } {
	const { dialog, ...rest } = search
	return {
		...rest,
		dialog:
			dialog === 'embed' || dialog === 'report' || dialog === 'verify'
				? dialog
				: undefined,
	}
}
