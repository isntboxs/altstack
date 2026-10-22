import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { createSeedGithubClient } from '../src/seed-file-github'

const mocks = vi.hoisted(() => {
	return {
		get: vi.fn(),
		getCommit: vi.fn(),
		getLatestRelease: vi.fn(),
		getReadme: vi.fn(),
		constructor: vi.fn(),
	}
})
vi.mock('octokit', () => {
	return {
		Octokit: class {
			constructor(options: unknown) {
				mocks.constructor(options)
			}
			rest = {
				repos: {
					get: mocks.get,
					getCommit: mocks.getCommit,
					getLatestRelease: mocks.getLatestRelease,
					getReadme: mocks.getReadme,
				},
			}
		},
	}
})

const repository = {
	id: 123,
	private: false,
	owner: { login: 'Renamed' },
	name: 'Tool',
	stargazers_count: 321,
	forks_count: 12,
	default_branch: 'main',
	created_at: '2020-01-01T00:00:00Z',
}
const failure = (status: number, message: string) =>
	Object.assign(new Error(message), { status })
beforeEach(() => {
	vi.clearAllMocks()
	mocks.get.mockReset().mockResolvedValue({ data: repository })
	mocks.getCommit.mockReset().mockResolvedValue({
		data: { commit: { committer: { date: '2026-01-01T00:00:00Z' } } },
	})
	mocks.getLatestRelease
		.mockReset()
		.mockResolvedValue({ data: { tag_name: 'v1.0.0' } })
	mocks.getReadme.mockReset().mockResolvedValue({
		data: {
			encoding: 'base64',
			size: 8,
			content: Buffer.from('# README').toString('base64'),
		},
	})
})

describe('mocked file seed GitHub adapter', () => {
	it('fetches public statistics with the normalized renamed identity and bounded requests', async () => {
		const result = await createSeedGithubClient('test-token').statistics(
			'old',
			'tool'
		)
		expect(result).toEqual({
			repositoryUrl: 'https://github.com/renamed/tool',
			githubRepositoryId: 123,
			topics: [],
			stars: 321,
			forks: 12,
			repositoryCreatedAt: new Date('2020-01-01'),
			lastCommitAt: new Date('2026-01-01'),
			latestReleaseTag: 'v1.0.0',
		})
		expect(mocks.getCommit).toHaveBeenCalledWith({
			owner: 'renamed',
			repo: 'tool',
			ref: 'main',
		})
		expect(mocks.constructor).toHaveBeenCalledWith(
			expect.objectContaining({
				auth: 'test-token',
				request: { timeout: 15_000 },
				retry: { enabled: false },
			})
		)
	})
	it('allows an empty repository and no releases after confirming continued access', async () => {
		mocks.getCommit.mockRejectedValueOnce(
			failure(409, 'Git Repository is empty.')
		)
		mocks.getLatestRelease.mockRejectedValueOnce(failure(404, 'Not found'))
		expect(
			await createSeedGithubClient().statistics('old', 'tool')
		).toMatchObject({ lastCommitAt: null, latestReleaseTag: null })
		expect(mocks.get).toHaveBeenCalledTimes(2)
	})
	it.each([403, 404, 500])(
		'propagates repository statistics failure %s',
		async (status) => {
			mocks.get.mockRejectedValueOnce(
				failure(status, 'repository request failed')
			)
			await expect(
				createSeedGithubClient().statistics('old', 'tool')
			).rejects.toThrow('repository request failed')
		}
	)
	it('rejects private repositories, invalid statistics and arbitrary commit conflicts', async () => {
		mocks.get.mockResolvedValueOnce({ data: { ...repository, private: true } })
		await expect(
			createSeedGithubClient().statistics('old', 'tool')
		).rejects.toThrow('publik')
		mocks.get.mockResolvedValueOnce({
			data: { ...repository, stargazers_count: -1 },
		})
		await expect(
			createSeedGithubClient().statistics('old', 'tool')
		).rejects.toThrow(/stars/)
		mocks.getCommit.mockRejectedValueOnce(failure(409, 'Arbitrary conflict'))
		await expect(
			createSeedGithubClient().statistics('old', 'tool')
		).rejects.toThrow('Arbitrary conflict')
	})
	it('rejects repository moves or disappearance when checking release absence', async () => {
		mocks.getLatestRelease.mockRejectedValueOnce(failure(404, 'No release'))
		mocks.get
			.mockResolvedValueOnce({ data: repository })
			.mockResolvedValueOnce({ data: { ...repository, id: 456 } })
		await expect(
			createSeedGithubClient().statistics('old', 'tool')
		).rejects.toThrow('Repository berubah')
	})
	it('decodes a UTF-8 README and returns null for missing README', async () => {
		const client = createSeedGithubClient()
		expect(await client.readme('renamed', 'tool')).toBe('# README')
		mocks.getReadme.mockRejectedValueOnce(failure(404, 'No README'))
		expect(await client.readme('renamed', 'tool')).toBeNull()
	})
	it('reports unavailable, oversized, malformed or binary README for the importer to warn', async () => {
		const client = createSeedGithubClient()
		mocks.getReadme.mockRejectedValueOnce(failure(500, 'README request failed'))
		await expect(client.readme('renamed', 'tool')).rejects.toThrow(
			'README request failed'
		)
		mocks.getReadme.mockResolvedValueOnce({
			data: { encoding: 'base64', size: 100 * 1024 + 1, content: '' },
		})
		await expect(client.readme('renamed', 'tool')).rejects.toThrow('100 KiB')
		mocks.getReadme.mockResolvedValueOnce({
			data: { encoding: 'base64', size: 1, content: '%bad%' },
		})
		await expect(client.readme('renamed', 'tool')).rejects.toThrow(
			'tidak valid'
		)
		mocks.getReadme.mockResolvedValueOnce({
			data: {
				encoding: 'base64',
				size: 1,
				content: Buffer.from('\u0000').toString('base64'),
			},
		})
		await expect(client.readme('renamed', 'tool')).rejects.toThrow('biner')
	})
})
