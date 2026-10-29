import { describe, expect, it } from 'vite-plus/test'

import { slugify } from '@altstack/shared/lib/slug'
import {
	adminCreateProjectBodySchema,
	adminUpdateProjectBodySchema,
	publishProjectSchema,
} from '@altstack/shared/schemas/admin-project'
import { projectSlugSchema, slugSchema } from '@altstack/shared/schemas/common'

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

describe('project route reservations', () => {
	it.each([
		'collections',
		' Collections! ',
		'tags',
		'bookmarks',
		'admin',
		'managed',
		'og',
		'sitemaps',
	])(
		'rejects normalized reserved project slug %s without restricting categories',
		(slug) => {
			const record = {
				name: 'Example Project',
				slug,
				repositoryUrl: 'https://github.com/example/project',
				tagline: 'A project',
				description: 'Project description',
				logo: 'projects/example/logo-550e8400-e29b-41d4-a716-446655440000.png',
				categorySlugs: ['tools'],
				status: 'draft',
			}
			expect(projectSlugSchema.safeParse(slug).success).toBe(false)
			expect(adminCreateProjectBodySchema.safeParse(record).success).toBe(false)
			expect(adminUpdateProjectBodySchema.safeParse({ slug }).success).toBe(
				false
			)
			expect(publishProjectSchema.safeParse(record).success).toBe(false)
			expect(slugSchema.safeParse(slug).success).toBe(true)
		}
	)
	it('allows project names that merely contain a reserved route word', () => {
		expect(projectSlugSchema.parse('Collections Project')).toBe(
			'collections-project'
		)
	})
})
