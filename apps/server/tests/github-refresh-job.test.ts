import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { main } from '../src/jobs/github-refresh'

const { prune, refresh, end, env } = vi.hoisted(() => {
	const testEnv: { GITHUB_TOKEN: string | undefined } = {
		GITHUB_TOKEN: 'synthetic-test-token',
	}
	return { prune: vi.fn(), refresh: vi.fn(), end: vi.fn(), env: testEnv }
})
vi.mock('@altstack/auth/server/magic-link-rate-limit', () => {
	return { pruneExpiredAuthRateLimits: prune }
})
vi.mock('@altstack/api/github-refresh-batch', () => {
	return { runGithubRefreshBatch: refresh }
})
vi.mock('@altstack/db', () => {
	return { db: { $client: { end } } }
})
vi.mock('@altstack/env/server', () => {
	return { env }
})

const originalExitCode = process.exitCode
const stdout = vi.fn<typeof process.stdout.write>()
const stderr = vi.fn<typeof process.stderr.write>()
beforeEach(() => {
	process.exitCode = undefined
	env.GITHUB_TOKEN = 'synthetic-test-token'
	prune.mockReset().mockResolvedValue({ cutoff: 123, deleted: 7 })
	refresh.mockReset().mockResolvedValue({ failed: 0 })
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

describe('daily refresh maintenance', () => {
	it('prunes auth quotas through the existing job and logs only cutoff/count', async () => {
		await main()
		expect(prune).toHaveBeenCalledOnce()
		expect(refresh).toHaveBeenCalledOnce()
		expect(prune.mock.invocationCallOrder[0]).toBeLessThan(
			refresh.mock.invocationCallOrder[0]!
		)
		expect(stdout).toHaveBeenCalledWith(
			`${JSON.stringify({ event: 'auth-rate-limit-pruned', cutoff: 123, deleted: 7 })}\n`
		)
		expect(end).toHaveBeenCalledOnce()
		expect(process.exitCode).toBeUndefined()
	})

	it('still prunes when GitHub configuration is missing and closes the pool', async () => {
		env.GITHUB_TOKEN = undefined
		await main()
		expect(prune).toHaveBeenCalledOnce()
		expect(refresh).not.toHaveBeenCalled()
		expect(end).toHaveBeenCalledOnce()
		expect(process.exitCode).toBe(1)
	})

	it('reports cleanup failure without logging keys or preventing GitHub refresh', async () => {
		prune.mockRejectedValueOnce(new Error('private-database-key'))
		await main()
		expect(stderr).toHaveBeenCalledWith(
			`${JSON.stringify({ event: 'auth-rate-limit-prune-failed' })}\n`
		)
		expect(JSON.stringify(stderr.mock.calls)).not.toContain(
			'private-database-key'
		)
		expect(refresh).toHaveBeenCalledOnce()
		expect(end).toHaveBeenCalledOnce()
		expect(process.exitCode).toBe(1)
	})
})
