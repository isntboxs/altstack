import { Octokit } from 'octokit'
import { z } from 'zod'

import { canonicalizeGithubUrl } from '@altstack/shared/lib/github'
import { githubLicenseMetadata } from '@altstack/shared/lib/github-license'
import { repositoryUrlSchema } from '@altstack/shared/schemas/common'
import { githubLicenseFields } from '@altstack/shared/schemas/license'
import { githubTopicsSchema } from '@altstack/shared/schemas/tag'

export const seedGithubStatisticsSchema = z.object({
	...githubLicenseFields,
	repositoryUrl: repositoryUrlSchema,
	topics: githubTopicsSchema.optional(),
	githubRepositoryId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
	stars: z.number().int().nonnegative().max(2_147_483_647),
	forks: z.number().int().nonnegative().max(2_147_483_647),
	repositoryCreatedAt: z.date(),
	lastCommitAt: z.date().nullable(),
	latestReleaseTag: z.string().min(1).nullable(),
})
export type SeedGithubStatistics = z.infer<typeof seedGithubStatisticsSchema>
export interface SeedGithubClient {
	statistics: (owner: string, repo: string) => Promise<SeedGithubStatistics>
	readme: (owner: string, repo: string) => Promise<string | null>
}

function hasStatus(error: unknown, status: number) {
	return (
		typeof error === 'object' &&
		error !== null &&
		'status' in error &&
		error.status === status
	)
}

// Construct only when --github is enabled. No full server environment or API
// package dependency; calls are bounded and never retry/rate-limit sleep.
export function createSeedGithubClient(token?: string): SeedGithubClient {
	const octokit = new Octokit({
		auth: token,
		userAgent: 'altstack-seed-file',
		request: { timeout: 15_000 },
		throttle: { onRateLimit: () => false, onSecondaryRateLimit: () => false },
		retry: { enabled: false },
	})
	async function publicRepository(owner: string, repo: string) {
		const { data } = await octokit.rest.repos.get({ owner, repo })
		if (data.private) throw new Error('Repository GitHub harus publik')
		const identity = canonicalizeGithubUrl(`${data.owner.login}/${data.name}`)
		return { data, identity }
	}
	return {
		async statistics(owner, repo) {
			const { data, identity } = await publicRepository(owner, repo)
			const resolved = { owner: identity.owner, repo: identity.repo }
			let lastCommitAt: Date | null = null
			try {
				const { data: commit } = await octokit.rest.repos.getCommit({
					...resolved,
					ref: data.default_branch,
				})
				if (!commit.commit.committer?.date) {
					throw new Error('Tanggal commit GitHub tidak tersedia')
				}
				lastCommitAt = new Date(commit.commit.committer.date)
			} catch (error) {
				if (
					!hasStatus(error, 409) ||
					!(error instanceof Error) ||
					!/^Git Repository is empty\.?($| - https:\/\/docs\.github\.com\/)/i.test(
						error.message
					)
				) {
					throw error
				}
			}
			let latestReleaseTag: string | null = null
			try {
				const { data: release } =
					await octokit.rest.repos.getLatestRelease(resolved)
				latestReleaseTag = release.tag_name
			} catch (error) {
				if (!hasStatus(error, 404)) throw error
				const verified = await publicRepository(resolved.owner, resolved.repo)
				if (
					verified.data.id !== data.id ||
					verified.identity.canonicalUrl !== identity.canonicalUrl
				) {
					throw new Error('Repository berubah saat mengambil statistik')
				}
			}
			return seedGithubStatisticsSchema.parse({
				repositoryUrl: identity.canonicalUrl,
				githubRepositoryId: data.id,
				...githubLicenseMetadata(data),
				topics: data.topics ?? [],
				stars: data.stargazers_count,
				forks: data.forks_count,
				repositoryCreatedAt: new Date(data.created_at),
				lastCommitAt,
				latestReleaseTag,
			})
		},
		async readme(owner, repo) {
			try {
				const { data } = await octokit.rest.repos.getReadme({ owner, repo })
				if (data.encoding !== 'base64' || data.size > 100 * 1024) {
					throw new Error('README bukan teks base64 atau melebihi 100 KiB')
				}
				const encoded = data.content.replace(/\s/g, '')
				const bytes = Buffer.from(encoded, 'base64')
				if (bytes.toString('base64') !== encoded || bytes.length > 100 * 1024) {
					throw new Error('Encoding/ukuran README tidak valid')
				}
				const content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
				if (content.includes('\u0000')) {
					throw new Error('README berisi data biner')
				}
				return content
			} catch (error) {
				if (hasStatus(error, 404)) return null
				throw error
			}
		},
	}
}
