import { env } from '@altstack/env/web'

// The API returns storage file keys (e.g. projects/{slug}/logo-{uuid}.png),
// never URLs. Resolve them here for display.
export const publicUrlForKey = (key: string) =>
	`${env.VITE_S3_PUBLIC_URL}/${key}`

// Absolute URLs pass through untouched so legacy rows and external images
// (e.g. seed avatars) keep rendering.
export function resolveFileUrl(value: string): string
export function resolveFileUrl(value: null | undefined): null
export function resolveFileUrl(value: string | null | undefined): string | null
export function resolveFileUrl(
	value: string | null | undefined
): string | null {
	if (!value) return null
	if (value.startsWith('http://') || value.startsWith('https://')) return value
	return publicUrlForKey(value)
}
