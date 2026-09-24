import { createRouterClient } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vite-plus/test'

import type { ORPCContext } from '@altstack/api/context'
import { routers } from '@altstack/api/routers'

import { db } from '@altstack/db'
import { category } from '@altstack/db/schemas'

const TEST_TIMEOUT = 30_000

// Fixture category with zero projects attached: the admin endpoint must
// still return it, unlike the public listCategories (published join).
const FIXTURE_SLUG = 'test-admin-nopubs'
const FIXTURE_NAME = 'Test Admin Nopubs'

function clientWith(auth: ORPCContext['auth']) {
	return createRouterClient(routers, {
		context: { db, auth },
	})
}

const adminClient = clientWith({
	user: { id: '00000000-0000-0000-0000-000000000000', role: 'admin' },
} as unknown as ORPCContext['auth'])
const userClient = clientWith({
	user: { id: '00000000-0000-0000-0000-000000000000', role: 'user' },
} as unknown as ORPCContext['auth'])
const anonClient = clientWith(null)

beforeAll(async () => {
	await db
		.insert(category)
		.values({
			slug: FIXTURE_SLUG,
			name: FIXTURE_NAME,
			description: 'Fixture category with no projects attached.',
		})
		.onConflictDoNothing({ target: category.slug })
})

afterAll(async () => {
	await db.delete(category).where(eq(category.slug, FIXTURE_SLUG))
})

describe('admin listCategories', () => {
	it(
		'returns every category ordered by name, even with no projects attached',
		{ timeout: TEST_TIMEOUT },
		async () => {
			const result = await adminClient.admin.project.listCategories({})

			const slugs = result.categories.map((item) => item.slug)
			expect(slugs).toContain(FIXTURE_SLUG)

			const names = result.categories.map((item) => item.name)
			expect(names.toSorted()).toEqual(names)
		}
	)

	it(
		'rejects anonymous callers with 401',
		{ timeout: TEST_TIMEOUT },
		async () => {
			await expect(
				anonClient.admin.project.listCategories({})
			).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
		}
	)

	it(
		'rejects non-admin users with 403',
		{ timeout: TEST_TIMEOUT },
		async () => {
			await expect(
				userClient.admin.project.listCategories({})
			).rejects.toMatchObject({ code: 'FORBIDDEN' })
		}
	)
})
