import { ORPCError } from '@orpc/server'
import { Octokit, RequestError } from 'octokit'

import { env } from '@altstack/env/server'

import { canonicalizeGithubUrl } from '@altstack/shared/lib/github'
import { adminCreateProjectBodySchema } from '@altstack/shared/schemas/admin-project'

export const octokit: Octokit = new Octokit({
	auth: env.GITHUB_TOKEN,
	userAgent: env.APP_NAME,
	timeZone: 'Asia/Jakarta',
})

async function fetchVerifiedPublicGithubRepository(
	owner: string,
	repo: string
) {
	try {
		const { data } = await octokit.rest.repos.get({ owner, repo })
		if (data.private) {
			throw new ORPCError('BAD_REQUEST', {
				message: 'The GitHub repository must be public.',
			})
		}
		// Resolve renamed/transferred repositories for every caller.
		const identity = canonicalizeGithubUrl(`${data.owner.login}/${data.name}`)
		return { data, identity }
	} catch (error) {
		if (error instanceof ORPCError) throw error
		if (error instanceof RequestError) {
			if (error.status === 404) {
				throw new ORPCError('NOT_FOUND', {
					message: 'Public GitHub repository not found.',
				})
			}
			if (error.status === 403 || error.status === 429) {
				throw new ORPCError('TOO_MANY_REQUESTS', {
					message:
						'GitHub is temporarily rate limited. Please try again later.',
				})
			}
		}
		throw new ORPCError('INTERNAL_SERVER_ERROR', {
			message: 'Unable to verify the GitHub repository. Please try again.',
		})
	}
}

export async function fetchPublicGithubRepository(owner: string, repo: string) {
	const { data, identity } = await fetchVerifiedPublicGithubRepository(
		owner,
		repo
	)
	return {
		...identity,
		stars: data.stargazers_count,
		forks: data.forks_count,
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
