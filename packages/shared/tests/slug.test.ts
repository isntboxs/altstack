import { describe, expect, it } from 'vite-plus/test'

import { slugify } from '@altstack/shared/lib/slug'
import { slugSchema } from '@altstack/shared/schemas/common'

describe('slugify', () => {
	it.each([
		['My Project', 'my-project'],
		['  Spaced Out  ', 'spaced-out'],
		['shadcn/ui', 'shadcn-ui'],
		['Vite+ Realtime: v2.0!', 'vite-realtime-v2-0'],
		['Zürich Käse', 'zuerich-kaese'],
	])('slugify(%s) → %s', (input, expected) => {
		expect(slugify(input)).toBe(expected)
	})

	it('output always passes the server slugSchema', () => {
		for (const input of [
			'My Project',
			'shadcn/ui',
			'TanStack Router!',
			'Dr. Who & Friends (2026)',
		]) {
			expect(() => slugSchema.parse(slugify(input))).not.toThrow()
		}
	})
})
