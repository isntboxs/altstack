import { ORPCError } from '@orpc/server'
import { Octokit, RequestError } from 'octokit'

import { env } from '@altstack/env/server'

import { canonicalizeGithubUrl } from '@altstack/shared/lib/github'

export const octokit: Octokit = new Octokit({
	auth: env.GITHUB_TOKEN,
	userAgent: env.APP_NAME,
	timeZone: 'Asia/Jakarta',
})

export async function fetchPublicGithubRepository(owner: string, repo: string) {
	try {
		const { data } = await octokit.rest.repos.get({ owner, repo })
		if (data.private) {
			throw new ORPCError('BAD_REQUEST', {
				message: 'The GitHub repository must be public.',
			})
		}
		// GitHub follows renamed/transferred repository URLs. Persist its current
		// identity so old URLs cannot create a second listing of the same repo.
		return {
			...canonicalizeGithubUrl(`${data.owner.login}/${data.name}`),
			stars: data.stargazers_count,
			forks: data.forks_count,
		}
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
