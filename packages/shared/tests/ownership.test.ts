import { describe, expect, it } from 'vite-plus/test'

import { claimBodySchema } from '@altstack/shared/schemas/ownership'

describe('project claim contact email', () => {
	it.each(['owner', 'maintainer'] as const)(
		'normalizes a pasted email before validating it for %s',
		(role) => {
			expect(
				claimBodySchema.parse({ email: ' \tPerson@Example.TEST\n ', role })
			).toEqual({ email: 'person@example.test', role })
		}
	)
	it('preserves email format and normalized length limits', () => {
		const domain = `${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(57)}.com`
		const email = `${'a'.repeat(64)}@${domain}`
		expect(email).toHaveLength(254)
		expect(
			claimBodySchema.parse({ email: ` ${email} `, role: 'owner' }).email
		).toBe(email)
		for (const invalid of [
			'',
			' \t ',
			'person@',
			'per son@example.test',
			`a${email}`,
		]) {
			expect(
				claimBodySchema.safeParse({ email: invalid, role: 'owner' }).success
			).toBe(false)
		}
	})
})
