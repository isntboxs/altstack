import { Redis } from '@upstash/redis'
import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vite-plus/test'

import { createSubmissionRateLimiter } from '@altstack/api/submission-rate-limit'

// The singleton is never used here. Integration credentials must be explicitly
// supplied for a dedicated DEVELOPMENT database; never use runtime/production keys.
vi.mock('@altstack/env/server', () => {
	return {
		env: {
			NODE_ENV: 'test',
			UPSTASH_REDIS_REST_URL: 'https://unused.test.invalid',
			UPSTASH_REDIS_REST_TOKEN: 'fake-unused-test-token',
		},
	}
})

const enabled = process.env.UPSTASH_RATELIMIT_INTEGRATION === '1'
describe.skipIf(!enabled)('development Upstash integration', () => {
	it('shares five attempts between two instances and a recreated instance', async () => {
		const url = process.env.UPSTASH_DEVELOPMENT_REDIS_REST_URL
		const token = process.env.UPSTASH_DEVELOPMENT_REDIS_REST_TOKEN
		if (!url || !token || process.env.NODE_ENV === 'production') {
			throw new Error(
				'Integration requires dedicated UPSTASH_DEVELOPMENT_REDIS_REST_URL/TOKEN and a non-production environment'
			)
		}
		const configuration = {
			url,
			token,
			retry: { retries: 0 },
			enableAutoPipelining: false,
			signal: () => AbortSignal.timeout(5_000),
		}
		const redis = new Redis(configuration)
		const prefix = `altstack:development:submission:create:integration:${randomUUID()}`
		const first = createSubmissionRateLimiter(redis, prefix)
		const second = createSubmissionRateLimiter(new Redis(configuration), prefix)
		try {
			for (let index = 0; index < 5; index++) {
				const result = await (index % 2 === 0 ? first : second).limit(
					'user:integration'
				)
				expect(result.success).toBe(true)
				expect(result.limit).toBe(5)
			}
			expect(await second.limit('user:integration')).toMatchObject({
				success: false,
				limit: 5,
				remaining: 0,
			})
			const restarted = createSubmissionRateLimiter(
				new Redis(configuration),
				prefix
			)
			expect(await restarted.limit('user:integration')).toMatchObject({
				success: false,
				remaining: 0,
			})
			expect(await first.limit('user:another-account')).toMatchObject({
				success: true,
				remaining: 4,
			})
		} finally {
			let cursor = '0'
			do {
				const [next, keys] = await redis.scan(cursor, {
					match: `${prefix}:*`,
					count: 100,
				})
				cursor = String(next)
				expect(keys.every((key) => key.startsWith(`${prefix}:`))).toBe(true)
				if (keys.length > 0) await redis.del(...keys)
			} while (cursor !== '0')
		}
	}, 60_000)
})
