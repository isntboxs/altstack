import type { RateLimiter } from '@orpc/ratelimit'
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

/** Creates a shared ten-minute sliding-window quota without local denial caching. */
export function createSubmissionRateLimiter(
	redis: Redis,
	prefix: string,
	maxRequests = 5
): RateLimiter {
	// Keep the sliding window and deployed counters; oRPC's Redis adapter now
	// implements a fixed window instead of wrapping @upstash/ratelimit.
	const ratelimit = new Ratelimit({
		redis,
		limiter: Ratelimit.slidingWindow(maxRequests, '10 m'),
		prefix,
		ephemeralCache: false,
		// Upstash's default timeout returns success without a Redis decision.
		// Disable it; the Redis request deadline above rejects instead.
		timeout: 0,
		analytics: false,
	})
	return {
		/** Consumes a positive integer weight; Redis failures reject instead of allowing the request. */
		limit(key, options) {
			const weight = options?.weight ?? 1
			if (!Number.isInteger(weight) || weight <= 0) {
				throw new TypeError(
					'Rate limit weight must be an integer greater than 0'
				)
			}
			return ratelimit.limit(key, { rate: weight })
		},
	}
}

export const submissionRateLimiter = createSubmissionRateLimiter(
	submissionRedis,
	// Retain the deployed key namespace. Create and resubmit share these counters.
	`altstack:${env.NODE_ENV}:submission:create`
)
