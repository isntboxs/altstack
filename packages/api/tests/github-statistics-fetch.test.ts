import { RequestError } from 'octokit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { fetchPublicGithubStatistics, octokit } from '@altstack/api/github'

type RepositoryResponse = Awaited<ReturnType<typeof octokit.rest.repos.get>>
type CommitResponse = Awaited<ReturnType<typeof octokit.rest.repos.getCommit>>
type ReleaseResponse = Awaited<
	ReturnType<typeof octokit.rest.repos.getLatestRelease>
>

function upstream(status: number, message = 'Upstream failure') {
	return new RequestError(message, status, {
		request: {
			method: 'GET',
			url: 'https://api.github.com/repos/old/repo',
			headers: {},
		},
	})
}
function repository(overrides: Record<string, unknown> = {}) {
	return {
		data: {
			private: false,
			owner: { login: 'CanonicalOwner' },
			name: 'CanonicalRepo',
			stargazers_count: 123,
			forks_count: 45,
			created_at: '2020-01-02T03:04:05Z',
			pushed_at: '2026-10-10T00:00:00Z',
			default_branch: 'trunk',
			...overrides,
		},
	} as unknown as RepositoryResponse
}

beforeEach(() => {
	vi.spyOn(octokit.rest.repos, 'get').mockResolvedValue(repository())
	vi.spyOn(octokit.rest.repos, 'getCommit').mockResolvedValue({
		data: {
			commit: {
				author: { date: '2020-01-01T00:00:00Z' },
				committer: { date: '2026-10-09T06:07:08Z' },
			},
		},
	} as unknown as CommitResponse)
	vi.spyOn(octokit.rest.repos, 'getLatestRelease').mockResolvedValue({
		data: { tag_name: 'v3.4.5' },
	} as unknown as ReleaseResponse)
})
afterEach(() => vi.restoreAllMocks())

describe('GitHub statistics fetch', () => {
	it('reads the default branch HEAD committer date and latest release with canonical identity', async () => {
		expect(await fetchPublicGithubStatistics('old', 'repo')).toEqual({
			canonicalUrl: 'https://github.com/canonicalowner/canonicalrepo',
			owner: 'canonicalowner',
			repo: 'canonicalrepo',
			stars: 123,
			forks: 45,
			lastCommitAt: new Date('2026-10-09T06:07:08Z'),
			repositoryCreatedAt: new Date('2020-01-02T03:04:05Z'),
			latestReleaseTag: 'v3.4.5',
		})
		expect(octokit.rest.repos.getCommit).toHaveBeenCalledExactlyOnceWith({
			owner: 'canonicalowner',
			repo: 'canonicalrepo',
			ref: 'trunk',
		})
		expect(octokit.rest.repos.getLatestRelease).toHaveBeenCalledExactlyOnceWith(
			{
				owner: 'canonicalowner',
				repo: 'canonicalrepo',
			}
		)
	})
	it.each([
		'Git Repository is empty.',
		'Git Repository is empty. - https://docs.github.com/rest/commits/commits#get-a-commit',
	])('records a confirmed empty repository: %s', async (message) => {
		vi.mocked(octokit.rest.repos.getCommit).mockRejectedValue(
			upstream(409, message)
		)
		expect(
			(await fetchPublicGithubStatistics('old', 'repo')).lastCommitAt
		).toBeNull()
	})
	it('records no release only after checking public access again, without tag/package fallback', async () => {
		vi.mocked(octokit.rest.repos.getLatestRelease).mockRejectedValue(
			upstream(404)
		)
		expect(
			(await fetchPublicGithubStatistics('old', 'repo')).latestReleaseTag
		).toBeNull()
		expect(octokit.rest.repos.get).toHaveBeenCalledTimes(2)
	})
	it('supports an empty repo without releases', async () => {
		vi.mocked(octokit.rest.repos.getCommit).mockRejectedValue(
			upstream(409, 'Git Repository is empty.')
		)
		vi.mocked(octokit.rest.repos.getLatestRelease).mockRejectedValue(
			upstream(404)
		)
		expect(await fetchPublicGithubStatistics('old', 'repo')).toMatchObject({
			lastCommitAt: null,
			latestReleaseTag: null,
		})
	})
	it('rejects private repositories before reading commits/releases', async () => {
		vi.mocked(octokit.rest.repos.get).mockResolvedValue(
			repository({ private: true })
		)
		await expect(
			fetchPublicGithubStatistics('old', 'repo')
		).rejects.toMatchObject({ code: 'BAD_REQUEST' })
		expect(octokit.rest.repos.getCommit).not.toHaveBeenCalled()
	})
	it.each([
		[404, 'NOT_FOUND'],
		[403, 'INTERNAL_SERVER_ERROR'],
		[429, 'TOO_MANY_REQUESTS'],
		[503, 'INTERNAL_SERVER_ERROR'],
	])('rejects repository error %s', async (status, code) => {
		vi.mocked(octokit.rest.repos.get).mockRejectedValue(
			upstream(Number(status))
		)
		await expect(
			fetchPublicGithubStatistics('old', 'repo')
		).rejects.toMatchObject({ code })
	})
	it.each([404, 409, 500])(
		'never mistakes commit error %s for an empty repository',
		async (status) => {
			vi.mocked(octokit.rest.repos.getCommit).mockRejectedValue(
				upstream(status)
			)
			await expect(
				fetchPublicGithubStatistics('old', 'repo')
			).rejects.toBeDefined()
		}
	)
	it('recognizes primary and secondary rate-limit 403 responses', async () => {
		vi.mocked(octokit.rest.repos.get).mockRejectedValue(
			upstream(403, 'API rate limit exceeded')
		)
		await expect(
			fetchPublicGithubStatistics('old', 'repo')
		).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
		vi.mocked(octokit.rest.repos.get).mockRejectedValue(
			upstream(403, 'You have exceeded a secondary rate limit')
		)
		await expect(
			fetchPublicGithubStatistics('old', 'repo')
		).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
	})
	it.each([429, 503])(
		'never mistakes release error %s for no release',
		async (status) => {
			vi.mocked(octokit.rest.repos.getLatestRelease).mockRejectedValue(
				upstream(status)
			)
			await expect(
				fetchPublicGithubStatistics('old', 'repo')
			).rejects.toBeDefined()
		}
	)
	it.each(['deleted', 'private', 'moved', 'unavailable'])(
		'rejects release absence if the repository became %s',
		async (state) => {
			vi.mocked(octokit.rest.repos.getLatestRelease).mockRejectedValue(
				upstream(404)
			)
			const get = vi.mocked(octokit.rest.repos.get)
			get.mockResolvedValueOnce(repository())
			if (state === 'deleted') get.mockRejectedValueOnce(upstream(404))
			if (state === 'private') {
				get.mockResolvedValueOnce(repository({ private: true }))
			}
			if (state === 'moved') {
				get.mockResolvedValueOnce(repository({ name: 'AnotherRepo' }))
			}
			if (state === 'unavailable') get.mockRejectedValueOnce(upstream(503))
			await expect(
				fetchPublicGithubStatistics('old', 'repo')
			).rejects.toBeDefined()
		}
	)
	it('rejects invalid/missing committer dates instead of erasing a stored commit', async () => {
		vi.mocked(octokit.rest.repos.getCommit).mockResolvedValue({
			data: { commit: { committer: { date: null } } },
		} as unknown as CommitResponse)
		await expect(
			fetchPublicGithubStatistics('old', 'repo')
		).rejects.toMatchObject({ code: 'INTERNAL_SERVER_ERROR' })
	})
})
