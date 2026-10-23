import 'zod/compile'
import { z } from 'zod'

const isLocalReturnTo = (value: unknown): value is string => {
	if (typeof value !== 'string') return false
	if (!value.startsWith('/')) return false
	if (value.startsWith('//')) return false
	if (value.startsWith('/\\')) return false
	if (value.includes('://')) return false
	if (value.includes('\\')) return false
	if (/[\p{Cc}\s<>]/u.test(value)) return false
	try {
		const url = new URL(value, 'https://altstack.invalid')
		const path = decodeURIComponent(url.pathname)
		return (
			url.origin === 'https://altstack.invalid' &&
			!path.startsWith('//') &&
			!path.includes('\\') &&
			!/[\p{Cc}\s<>]/u.test(path) &&
			!/^\/auth(?:\/|$)/.test(path)
		)
	} catch {
		return false
	}
}

const returnToSchema = z
	.string()
	.refine(isLocalReturnTo)
	.optional()
	.catch(undefined)

export const resolveReturnTo = (raw: unknown, fallback: '/'): string =>
	returnToSchema.parse(raw) ?? fallback
