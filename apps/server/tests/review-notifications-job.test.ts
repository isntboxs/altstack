import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { main } from '../src/jobs/review-notifications'

const { batch, end } = vi.hoisted(() => {
	return { batch: vi.fn(), end: vi.fn() }
})
vi.mock('@altstack/api/review-notification-delivery', () => {
	return {
		runReviewNotificationBatch: batch,
	}
})
vi.mock('@altstack/db', () => {
	return { db: { $client: { end } } }
})

const originalExitCode = process.exitCode
const stdout = vi.fn<typeof process.stdout.write>()
const stderr = vi.fn<typeof process.stderr.write>()
beforeEach(() => {
	process.exitCode = undefined
	batch.mockReset().mockResolvedValue({
		claimed: 1,
		sent: 1,
		retry: 0,
		failed: 0,
		cancelled: 0,
		skipped: false,
	})
	end.mockReset().mockResolvedValue(undefined)
	stdout.mockReset().mockReturnValue(true)
	stderr.mockReset().mockReturnValue(true)
	vi.spyOn(process.stdout, 'write').mockImplementation(stdout)
	vi.spyOn(process.stderr, 'write').mockImplementation(stderr)
})
afterEach(() => {
	process.exitCode = originalExitCode
	vi.restoreAllMocks()
})

describe('scheduled review delivery', () => {
	it('logs only aggregate results and closes the pool', async () => {
		await main()
		expect(JSON.parse(stdout.mock.calls[0]![0] as string)).toEqual({
			event: 'review-notifications-summary',
			claimed: 1,
			sent: 1,
			retry: 0,
			failed: 0,
			cancelled: 0,
			skipped: false,
		})
		expect(end).toHaveBeenCalledOnce()
		expect(process.exitCode).toBeUndefined()
	})
	it.each([{ retry: 1 }, { failed: 1 }, { skipped: true }])(
		'signals an operational issue for %j',
		async (summary) => {
			batch.mockResolvedValue(summary)
			await main()
			expect(process.exitCode).toBe(1)
			expect(end).toHaveBeenCalledOnce()
		}
	)
	it('discards raw provider/DB details on failure and closes the pool', async () => {
		batch.mockRejectedValue(
			new Error('private@example.test secret token https://private.test')
		)
		await main()
		expect(stderr).toHaveBeenCalledWith(
			`${JSON.stringify({ event: 'review-notifications-failed' })}\n`
		)
		expect(stdout).not.toHaveBeenCalled()
		expect(end).toHaveBeenCalledOnce()
		expect(process.exitCode).toBe(1)
	})
})
