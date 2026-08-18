import { z } from 'zod'

import { baseContract } from '@altstack/api/contracts/base'

const listCommitsContract = baseContract
	.route({
		path: '/commits',
		method: 'GET',
		summary: 'Get commits',
		description: 'Retrieve a list of commits.',
		tags: ['Commits'],
		operationId: 'getCommits',
		successStatus: 200,
		successDescription: 'List of commits retrieved successfully',
	})
	.output(
		z
			.object({
				sha: z.string(),
				htmlUrl: z.url(),
				message: z.string(),
				author: z.object({
					name: z.string().nullish(),
					email: z.string().nullish(),
					date: z.string().nullish(),
					avatarUrl: z.url().nullish(),
				}),
			})
			.array()
	)

export const altstackContract = {
	listCommits: listCommitsContract,
}
