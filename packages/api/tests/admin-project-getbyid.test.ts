import { createRouterClient } from '@orpc/server'
import { describe, expect, it } from 'vite-plus/test'

import type { ORPCContext } from '@altstack/api/context'
import { routers } from '@altstack/api/routers'

import { db } from '@altstack/db'

const TEST_TIMEOUT = 30_000
const MISSING_ID = '550e8400-e29b-41d4-a716-446655440000'

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

describe('admin getById', () => {
	it(
		'throws NOT_FOUND for an unknown id',
		{ timeout: TEST_TIMEOUT },
		async () => {
			await expect(
				adminClient.admin.project.getById({ params: { id: MISSING_ID } })
			).rejects.toMatchObject({ code: 'NOT_FOUND' })
		}
	)

	it(
		'rejects invalid uuid input with 400',
		{ timeout: TEST_TIMEOUT },
		async () => {
			await expect(
				adminClient.admin.project.getById({ params: { id: 'not-a-uuid' } })
			).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		}
	)

	it(
		'rejects anonymous callers with 401',
		{ timeout: TEST_TIMEOUT },
		async () => {
			await expect(
				anonClient.admin.project.getById({ params: { id: MISSING_ID } })
			).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
		}
	)

	it(
		'rejects non-admin users with 403',
		{ timeout: TEST_TIMEOUT },
		async () => {
			await expect(
				userClient.admin.project.getById({ params: { id: MISSING_ID } })
			).rejects.toMatchObject({ code: 'FORBIDDEN' })
		}
	)
})
