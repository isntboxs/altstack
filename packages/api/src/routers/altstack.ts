import { octokit } from '@altstack/api/github'
import { publicProcedure } from '@altstack/api/procedures'

const listCommitsHandler = publicProcedure.altstack.listCommits.handler(
	async () => {
		const { data } = await octokit.rest.repos.listCommits({
			owner: 'isntboxs',
			repo: 'altstack',
			per_page: 10,
		})

		return data.map((commit) => {
			return {
				sha: commit.sha,
				htmlUrl: commit.html_url,
				message: commit.commit.message,
				author: {
					name: commit.commit.author?.name,
					email: commit.commit.author?.email,
					date: commit.commit.author?.date,
					avatarUrl: commit.author?.avatar_url,
				},
			}
		})
	}
)

export const altstackRouter = {
	listCommits: listCommitsHandler,
}
