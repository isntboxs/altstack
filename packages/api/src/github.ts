import { ORPCError } from '@orpc/server'
import { Buffer } from 'node:buffer'
import { Octokit, RequestError } from 'octokit'

import {
	MAX_README_BYTES,
	normalizeGithubReadme,
} from '@altstack/api/github-readme'

import { env } from '@altstack/env/server'

import { canonicalizeGithubUrl } from '@altstack/shared/lib/github'
import { adminCreateProjectBodySchema } from '@altstack/shared/schemas/admin-project'

export const octokit: Octokit = new Octokit({
	auth: env.GITHUB_TOKEN,
	userAgent: env.APP_NAME,
	timeZone: 'Asia/Jakarta',
	request: { timeout: 15_000 },
	// Let callers report/stop on rate limits instead of sleeping inside a job.
	throttle: {
		onRateLimit: () => false,
		onSecondaryRateLimit: () => false,
	},
	retry: { enabled: false },
})

async function fetchVerifiedPublicGithubRepository(
	owner: string,
	repo: string,
	mapError = githubRequestError
) {
	try {
		const { data } = await octokit.rest.repos.get({ owner, repo })
		if (data.private) {
			throw new ORPCError('BAD_REQUEST', {
				message: 'The GitHub repository must be public.',
			})
		}
		if (!Number.isSafeInteger(data.id) || data.id <= 0) {
			throw new Error('GitHub returned an invalid repository ID')
		}
		// Resolve renamed/transferred repositories for every caller.
		const identity = canonicalizeGithubUrl(`${data.owner.login}/${data.name}`)
		return { data, identity }
	} catch (error) {
		throw mapError(
			error,
			'Unable to verify the GitHub repository. Please try again.',
			'Public GitHub repository not found.'
		)
	}
}

export async function fetchPublicGithubRepository(owner: string, repo: string) {
	const { data, identity } = await fetchVerifiedPublicGithubRepository(
		owner,
		repo
	)
	return {
		...identity,
		githubRepositoryId: data.id,
		stars: data.stargazers_count,
		forks: data.forks_count,
	}
}

function githubDate(value: string | null | undefined) {
	if (!value) throw new Error('GitHub returned a missing date')
	const date = new Date(value)
	if (!Number.isFinite(date.getTime())) {
		throw new Error('GitHub returned an invalid date')
	}
	return date
}

export async function fetchPublicGithubStatistics(owner: string, repo: string) {
	const { data: repository, identity } =
		await fetchVerifiedPublicGithubRepository(
			owner,
			repo,
			githubStatisticsRequestError
		)
	try {
		const repositoryCreatedAt = githubDate(repository.created_at)
		const resolved = { owner: identity.owner, repo: identity.repo }
		let lastCommitAt: Date | null = null
		try {
			const { data } = await octokit.rest.repos.getCommit({
				...resolved,
				ref: repository.default_branch,
			})
			lastCommitAt = githubDate(data.commit.committer?.date)
		} catch (error) {
			// A missing branch (404) or arbitrary conflict is not an empty repo.
			if (
				!(error instanceof RequestError) ||
				error.status !== 409 ||
				!/^Git Repository is empty\.?(?:$| - https:\/\/docs\.github\.com\/)/i.test(
					error.message
				)
			) {
				throw error
			}
		}
		let latestReleaseTag: string | null = null
		try {
			const { data } = await octokit.rest.repos.getLatestRelease(resolved)
			if (!data.tag_name) {
				throw new Error('GitHub returned an empty release tag')
			}
			latestReleaseTag = data.tag_name
		} catch (error) {
			if (!(error instanceof RequestError) || error.status !== 404) throw error
			// The release endpoint also returns 404 for deleted/private repos.
			// Confirm continued public access before recording "No releases".
			const verified = await fetchVerifiedPublicGithubRepository(
				resolved.owner,
				resolved.repo,
				githubStatisticsRequestError
			)
			if (
				verified.identity.canonicalUrl !== identity.canonicalUrl ||
				verified.data.id !== repository.id
			) {
				throw new ORPCError('CONFLICT', {
					message: 'The GitHub repository moved during refresh. Please retry.',
				})
			}
		}
		return {
			...identity,
			githubRepositoryId: repository.id,
			stars: repository.stargazers_count,
			forks: repository.forks_count,
			repositoryCreatedAt,
			lastCommitAt,
			latestReleaseTag,
		}
	} catch (error) {
		throw githubStatisticsRequestError(
			error,
			'Unable to refresh GitHub statistics. Please try again.',
			'Public GitHub repository not found.'
		)
	}
}

export async function fetchPublicGithubMetadata(owner: string, repo: string) {
	const { data, identity } = await fetchVerifiedPublicGithubRepository(
		owner,
		repo
	)
	const description = data.description?.trim()
	const homepage = data.homepage?.trim()
	const website =
		adminCreateProjectBodySchema.shape.websiteUrl.safeParse(homepage)
	return {
		repositoryUrl: identity.canonicalUrl,
		description: description === '' ? null : (description ?? null),
		websiteUrl: website.success ? (website.data ?? null) : null,
	}
}

function githubRequestError(error: unknown, message: string, notFound: string) {
	if (error instanceof ORPCError) return error
	if (error instanceof RequestError) {
		if (error.status === 404) {
			return new ORPCError('NOT_FOUND', { message: notFound })
		}
		if (error.status === 403 || error.status === 429) {
			return new ORPCError('TOO_MANY_REQUESTS', {
				message: 'GitHub is temporarily rate limited. Please try again later.',
			})
		}
	}
	return new ORPCError('INTERNAL_SERVER_ERROR', { message })
}

function githubStatisticsRequestError(
	error: unknown,
	message: string,
	notFound: string
) {
	if (error instanceof RequestError && error.status === 403) {
		const headers = error.response?.headers
		const rateLimited =
			headers?.['x-ratelimit-remaining'] === '0' ||
			headers?.['retry-after'] !== undefined ||
			/rate limit|abuse/i.test(error.message)
		// An individual repository access restriction must not stop the whole batch.
		if (!rateLimited) return new ORPCError('INTERNAL_SERVER_ERROR', { message })
	}
	return githubRequestError(error, message, notFound)
}

export async function fetchPublicGithubReadme(owner: string, repo: string) {
	const { data: repository, identity } =
		await fetchVerifiedPublicGithubRepository(owner, repo)
	const resolved = { owner: identity.owner, repo: identity.repo }
	let commitSha: string
	try {
		const { data } = await octokit.rest.repos.getCommit({
			...resolved,
			ref: repository.default_branch,
		})
		commitSha = data.sha
		if (!/^[a-f0-9]{40}$/i.test(commitSha)) {
			throw new Error('Invalid commit SHA')
		}
	} catch (error) {
		throw githubRequestError(
			error,
			'Unable to resolve the GitHub README commit. Please try again.',
			'The repository has no readable default branch commit.'
		)
	}
	try {
		// Never use a mutable branch or a download_url supplied by repository content.
		const { data } = await octokit.rest.repos.getReadme({
			...resolved,
			ref: commitSha,
			headers: { accept: 'application/vnd.github+json' },
		})
		const invalid = (message: string) =>
			new ORPCError('BAD_REQUEST', { message })
		if (data.size > MAX_README_BYTES) {
			throw invalid(
				'README exceeds the 100 KiB import limit. It cannot be imported without truncation.'
			)
		}
		const filename = data.path.split('/').at(-1) ?? ''
		const extension = /\.([^.]*)$/.exec(filename)?.[1]?.toLowerCase()
		if (
			extension !== undefined &&
			!['md', 'markdown', 'txt'].includes(extension)
		) {
			throw invalid(
				'Unsupported README format. Use .md, .markdown, .txt, or a README without an extension.'
			)
		}
		if (
			!data.path ||
			data.path.startsWith('/') ||
			data.path.includes('\\') ||
			data.path.split('/').some((part) => part === '..' || part === '.')
		) {
			throw invalid('GitHub returned an invalid README path.')
		}
		const encoded = data.content.replace(/\s/g, '')
		if (
			data.encoding !== 'base64' ||
			!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
				encoded
			)
		) {
			throw invalid(
				'README has an unsupported or invalid encoding. UTF-8 text is required.'
			)
		}
		const bytes = Buffer.from(encoded, 'base64')
		if (bytes.length > MAX_README_BYTES) {
			throw invalid(
				'README exceeds the 100 KiB import limit. It cannot be imported without truncation.'
			)
		}
		let markdown: string
		try {
			if (bytes.toString('base64') !== encoded) {
				throw new Error('Invalid base64')
			}
			markdown = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
			if (markdown.includes('\u0000')) throw new Error('Binary content')
		} catch {
			throw invalid(
				'README has an unsupported or invalid encoding. UTF-8 text is required.'
			)
		}
		if (!markdown.trim()) throw invalid('README is empty.')
		const normalized = normalizeGithubReadme(markdown, {
			repositoryUrl: identity.canonicalUrl,
			path: data.path,
			commitSha,
		})
		if (!normalized.markdown) {
			throw invalid('README has no supported content after conversion.')
		}
		return {
			repositoryUrl: identity.canonicalUrl,
			path: data.path,
			commitSha,
			...normalized,
		}
	} catch (error) {
		throw githubRequestError(
			error,
			'Unable to fetch the GitHub README. Please try again.',
			'No README was found in this GitHub repository.'
		)
	}
}
