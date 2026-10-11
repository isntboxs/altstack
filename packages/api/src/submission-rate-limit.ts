import { UpstashRateLimiter } from '@orpc/ratelimit/upstash'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

import { env } from '@altstack/env/server'

// Shared Redis counters survive restarts. Environments never share a namespace.
export const submissionRedis = new Redis({
	url: env.UPSTASH_REDIS_REST_URL,
	token: env.UPSTASH_REDIS_REST_TOKEN,
	retry: { retries: 0 },
	enableAutoPipelining: false,
	cache: 'no-store',
	// A fresh signal per request is required: a singleton signal would eventually
	// abort every future request. Redis propagates aborts from signal factories.
	signal: () => AbortSignal.timeout(5_000),
})

export function createSubmissionRateLimiter(redis: Redis, prefix: string) {
	return new UpstashRateLimiter(
		new Ratelimit({
			redis,
			limiter: Ratelimit.slidingWindow(5, '10 m'),
			prefix,
			ephemeralCache: false,
			// Upstash's default timeout returns success without a Redis decision.
			// Disable it; the Redis request deadline above rejects instead.
			timeout: 0,
			analytics: false,
		}),
		{ blockingUntilReady: { enabled: false, timeout: 0 } }
	)
}

export const submissionRateLimiter = createSubmissionRateLimiter(
	submissionRedis,
	`altstack:${env.NODE_ENV}:submission:create`
)
