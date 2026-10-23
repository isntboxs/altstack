import { runReviewNotificationBatch } from '@altstack/api/review-notification-delivery'

import { db } from '@altstack/db'

export async function main() {
	try {
		const summary = await runReviewNotificationBatch(db)
		process.stdout.write(
			`${JSON.stringify({ event: 'review-notifications-summary', ...summary })}\n`
		)
		if (summary.failed || summary.retry || summary.skipped) process.exitCode = 1
	} catch {
		// No event payloads, recipients, URLs or raw DB/provider errors in logs.
		process.stderr.write(
			`${JSON.stringify({ event: 'review-notifications-failed' })}\n`
		)
		process.exitCode = 1
	} finally {
		await db.$client.end()
	}
}

if (import.meta.main) await main()
