import limax from 'limax'

import { octokit } from '@altstack/api/github'
import { adminProcedure } from '@altstack/api/procedures'

import { githubRepo, project } from '@altstack/db/schemas'

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
	const match = /github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git|\/)?$/i.exec(
		url.trim()
	)
	if (!match?.[1] || !match[2]) {
		return null
	}

	return {
		owner: match[1],
		repo: match[2],
	}
}

const createProjectHandler = adminProcedure.project.create.handler(
	async ({ context, errors, input }) => {
		const { auth, db } = context

		const parsedGithub = parseGitHubUrl(input.repositoryUrl)
		if (!parsedGithub) {
			throw errors.BAD_REQUEST({
				message: 'Invalid GitHub repository URL format',
			})
		}

		const { owner, repo } = parsedGithub

		const { data: repoData } = await octokit.rest.repos.get({
			owner,
			repo,
		})

		const { data: readmeData } = await octokit.rest.repos.getReadme({
			owner,
			repo,
		})

		const slug = limax(repoData.name)

		const result = await db.transaction(async (tx) => {
			const [newProject] = await tx
				.insert(project)
				.values({
					submitterId: auth.user.id,
					name: input.name,
					slug,
					repositoryUrl: input.repositoryUrl,
					websiteUrl: input.websiteUrl,
					tagline: input.tagline,
					shortDescription: input.shortDescription,
					logoUrl: input.logoUrl,
					content: readmeData.content,
				})
				.returning()

			if (!newProject) {
				throw errors.INTERNAL_SERVER_ERROR({
					message: 'Failed to create project',
				})
			}

			const [newGithubRepo] = await tx
				.insert(githubRepo)
				.values({
					projectId: newProject.id,
					owner,
					repo,
					stars: repoData.stargazers_count,
					forks: repoData.forks_count,
				})
				.returning()
			return {
				...newProject,
				github: newGithubRepo,
			}
		})

		return result
	}
)

export const projectRouter = {
	create: createProjectHandler,
}
