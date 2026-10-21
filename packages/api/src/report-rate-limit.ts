import {
	createSubmissionRateLimiter,
	submissionRedis,
} from '@altstack/api/submission-rate-limit'

import { env } from '@altstack/env/server'

export const reportRateLimiter = createSubmissionRateLimiter(
	submissionRedis,
	`altstack:${env.NODE_ENV}:report:identity`
)
// Unverified email can be rotated. Bound total anonymous intake as well, without
// trusting forwarding headers or storing reporter IP addresses.
export const guestReportRateLimiter = createSubmissionRateLimiter(
	submissionRedis,
	`altstack:${env.NODE_ENV}:report:guest`,
	50
)
