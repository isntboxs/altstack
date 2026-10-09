import { describe, expect, it, vi } from 'vite-plus/test'

import server from '../src/index'

vi.mock('@altstack/env/server', () => {
	return {
		env: {
			NODE_ENV: 'test',
			PORT: 3009,
			CORS_ORIGINS: ['http://localhost:3010'],
		},
	}
})
vi.mock('@altstack/auth/server', () => {
	return { auth: { handler: vi.fn() } }
})
vi.mock('evlog/better-auth', () => {
	return {
		createAuthMiddleware: () => () => Promise.resolve(undefined),
	}
})
vi.mock('evlog/fs', () => {
	return { createFsDrain: () => undefined }
})
vi.mock('@altstack/api/context', () => {
	return {
		createORPCContext: () => Promise.resolve({}),
	}
})
vi.mock('@altstack/api/handler', () => {
	const handler = {
		handle: () =>
			Promise.resolve({
				matched: true,
				response: new Response('{}', {
					status: 429,
					headers: {
						'RateLimit-Limit': '5',
						'RateLimit-Remaining': '0',
						'RateLimit-Reset': '1800000000000',
						'Retry-After': '60',
					},
				}),
			}),
	}
	return { rpcHandler: handler, openApiHandler: handler }
})

describe('submission rate-limit CORS headers', () => {
	it.each(['/api/rpc/submission/create', '/api/reference/submissions'])(
		'exposes all limiter headers to the web origin on %s',
		async (path) => {
			const response = await server.fetch(
				new Request(`http://localhost:3009${path}`, {
					method: 'POST',
					headers: { origin: 'http://localhost:3010' },
				})
			)
			expect(response.status).toBe(429)
			expect(response.headers.get('access-control-allow-origin')).toBe(
				'http://localhost:3010'
			)
			expect(response.headers.get('access-control-allow-credentials')).toBe(
				'true'
			)
			expect(
				response.headers
					.get('access-control-expose-headers')
					?.split(',')
					.map((header) => header.trim().toLowerCase())
			).toEqual([
				'ratelimit-limit',
				'ratelimit-remaining',
				'ratelimit-reset',
				'retry-after',
			])
			expect(response.headers.get('retry-after')).toBe('60')
		}
	)
})
