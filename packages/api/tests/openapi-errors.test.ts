import { describe, expect, it, vi } from 'vite-plus/test'

import { openApiHandler } from '@altstack/api/handler'

import { db } from '@altstack/db'

const failure = vi.hoisted(() => {
	return { code: 'UPLOAD_CONSUMED' }
})

vi.mock('@altstack/env/server', () => {
	return { env: { BETTER_AUTH_URL: 'http://localhost' } }
})
vi.mock('@altstack/db', () => {
	return { db: {} }
})
vi.mock('@altstack/api/routers', async () => {
	const { os, ORPCError } = await import('@orpc/server')
	const { openapi } = await import('@orpc/openapi')
	const { ORPC_ERRORS } = await import('@altstack/shared/constants/orpc-errors')
	return {
		routers: {
			probe: os
				.errors(ORPC_ERRORS)
				.meta(openapi({ method: 'GET', path: '/error' }))
				.handler(() => {
					throw new ORPCError(failure.code)
				}),
		},
	}
})

describe('OpenAPI error statuses', () => {
	it.each([
		['UPLOAD_CONSUMED', 500],
		['UPLOAD_EXPIRED', 400],
		['CONFLICT_AFTER_PROMOTE', 409],
		['UNAUTHORIZED', 401],
		['INTERNAL_SERVER_ERROR', 500],
		['UNKNOWN_ERROR', 400],
	])('returns %s with HTTP and body status %i', async (code, status) => {
		failure.code = code
		const result = await openApiHandler.handle(
			new Request('http://localhost/error'),
			{ context: { db, auth: null } }
		)
		expect(result.response?.status).toBe(status)
		expect(await result.response?.json()).toMatchObject({ code, status })
	})

	it('documents the same custom upload error statuses', async () => {
		const result = await openApiHandler.handle(
			new Request('http://localhost/spec.json'),
			{ context: { db, auth: null } }
		)
		expect(result.response?.status).toBe(200)
		const spec: unknown = await result.response?.json()
		const schemas: unknown = expect.arrayContaining([
			{ $ref: '#/components/schemas/UploadConsumed' },
		])
		expect(spec).toMatchObject({
			paths: {
				'/error': {
					get: {
						responses: {
							'500': {
								content: {
									'application/json': {
										schema: {
											oneOf: schemas,
										},
									},
								},
							},
						},
					},
				},
			},
		})
	})
})
