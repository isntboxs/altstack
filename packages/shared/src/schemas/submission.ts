import 'zod/compile'
import { z } from 'zod'

import {
	INVALID_REPOSITORY_URL_MESSAGE,
	canonicalizeGithubUrl,
} from '@altstack/shared/lib/github'

const repositoryUrlSchema = z
	.string()
	.trim()
	.min(1, { error: INVALID_REPOSITORY_URL_MESSAGE })
	.transform((value, ctx) => {
		try {
			return canonicalizeGithubUrl(value).canonicalUrl
		} catch (error) {
			ctx.addIssue({
				code: 'custom',
				message:
					error instanceof Error
						? error.message
						: INVALID_REPOSITORY_URL_MESSAGE,
			})

			return z.NEVER
		}
	})

export const createSubmissionInputSchema = z.object({
	name: z.string().trim().nonempty().max(100),
	repositoryUrl: repositoryUrlSchema,
	websiteUrl: z.url({ protocol: /^https$/, error: 'Invalid URL' }).optional(),
})
