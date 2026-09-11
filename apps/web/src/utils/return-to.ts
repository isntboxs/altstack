import 'zod/compile'
import { z } from 'zod'

const isLocalReturnTo = (value: unknown): value is string => {
	if (typeof value !== 'string') return false
	if (!value.startsWith('/')) return false
	if (value.startsWith('//')) return false
	if (value.startsWith('/\\')) return false
	if (value.includes('://')) return false
	if (value.includes('\\')) return false
	if (/[\s<>]/.test(value)) return false
	return true
}

const returnToSchema = z
	.string()
	.refine(isLocalReturnTo)
	.optional()
	.catch(undefined)

export const resolveReturnTo = (raw: unknown, fallback: '/'): string =>
	returnToSchema.parse(raw) ?? fallback
