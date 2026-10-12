import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { runSeedFileCli } from '../src/seed-file-cli'

const mocks = vi.hoisted(() => {
	return {
		end: vi.fn().mockResolvedValue(undefined),
		create: vi.fn(),
		read: vi.fn().mockResolvedValue({ projects: [], categories: [] }),
		import: vi.fn(),
		github: vi.fn(),
	}
})
vi.mock('pg', () => {
	return {
		Pool: class {
			end = mocks.end
			constructor(options: unknown) {
				mocks.create(options)
			}
		},
	}
})
vi.mock('drizzle-orm/node-postgres', () => {
	return { drizzle: vi.fn().mockReturnValue({}) }
})
vi.mock('../src/seed-file-parser', () => {
	return { readSeedFiles: mocks.read }
})
vi.mock('../src/seed-file-import', () => {
	return { importSeedFiles: mocks.import }
})
vi.mock('../src/seed-file-github', () => {
	return { createSeedGithubClient: mocks.github }
})

afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllEnvs()
	vi.clearAllMocks()
})
describe('file seed CLI lifecycle', () => {
	it('has no environment, pool or network side effects on import', () => {
		expect(mocks.create).not.toHaveBeenCalled()
		expect(mocks.github).not.toHaveBeenCalled()
	})
	it.each([false, true])(
		'closes its pool when importer failure is %s',
		async (failure) => {
			vi.stubEnv('DATABASE_URL', 'postgres://test/scoped')
			vi.spyOn(process.stdout, 'write').mockReturnValue(true)
			vi.spyOn(process.stderr, 'write').mockReturnValue(true)
			const count = { created: 0, skipped: 0 }
			if (failure) {
				mocks.import.mockRejectedValueOnce(new Error('planned failure'))
			} else {
				mocks.import.mockResolvedValueOnce({
					dryRun: false,
					categories: count,
					paths: count,
					projects: count,
					githubRepositories: count,
					relations: count,
					warnings: [],
				})
			}
			expect(await runSeedFileCli(['--categories', 'input.json'])).toBe(
				failure ? 1 : 0
			)
			expect(mocks.create).toHaveBeenCalledWith(
				expect.objectContaining({ connectionString: 'postgres://test/scoped' })
			)
			expect(mocks.end).toHaveBeenCalledOnce()
			expect(mocks.github).not.toHaveBeenCalled()
		}
	)
})
