// @vitest-environment node
import { describe, expect, it, vi } from 'vite-plus/test'
import type { ZodType } from 'zod'

import '#/features/public-content/server-function'

const { registerValidator } = vi.hoisted(() => {
	return { registerValidator: vi.fn<(schema: ZodType) => void>() }
})

vi.mock('@tanstack/react-start', () => {
	return {
		createServerFn: () => {
			return {
				validator: (schema: ZodType) => {
					registerValidator(schema)
					return { handler: vi.fn() }
				},
			}
		},
	}
})

describe('public content server input', () => {
	const validator = registerValidator.mock.calls[0][0]

	it('accepts the document boundary and rejects larger anonymous input', () => {
		const input = { slug: 'project', content: 'x'.repeat(100 * 1024) }
		expect(validator.safeParse(input).success).toBe(true)
		expect(
			validator.safeParse({ ...input, content: input.content + 'x' }).success
		).toBe(false)
	})

	it('preserves source whitespace and the existing slug bounds', () => {
		const input = { slug: 'x'.repeat(100), content: '\tcode  \n\n' }
		expect(validator.parse(input)).toEqual(input)
		expect(validator.safeParse({ slug: 'project', content: '' }).success).toBe(
			true
		)
		for (const slug of ['', 'x'.repeat(101)]) {
			expect(validator.safeParse({ ...input, slug }).success).toBe(false)
		}
	})
})
