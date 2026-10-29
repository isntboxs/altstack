import { z } from 'zod'

export const collectionKinds = [
	'alternatives',
	'repository',
	'ecosystem',
] as const
export const collectionKindLabels = {
	alternatives: 'Alternatives',
	repository: 'Curated list',
	ecosystem: 'Ecosystem / toolchain',
}
export const collectionSlugSchema = z
	.string()
	.trim()
	.min(1)
	.max(100)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
export const sourceRepositorySchema = z
	.url()
	.max(300)
	.transform((value, ctx) => {
		const url = new URL(value)
		if (
			url.protocol !== 'https:' ||
			url.hostname !== 'github.com' ||
			url.username ||
			url.password ||
			url.port ||
			url.search ||
			url.hash ||
			!/^\/[a-z\d](?:[a-z\d-]{0,38})\/[a-z\d._-]+\/?$/i.test(url.pathname)
		) {
			ctx.addIssue({
				code: 'custom',
				message:
					'Use an HTTPS GitHub repository URL (https://github.com/owner/repo).',
			})
			return z.NEVER
		}
		const path = url.pathname
			.replace(/\/$/, '')
			.replace(/\.git$/i, '')
			.toLowerCase()
		if (['.', '..', ''].includes(path.split('/')[2] ?? '')) {
			ctx.addIssue({ code: 'custom', message: 'Invalid repository name.' })
			return z.NEVER
		}
		return `https://github.com${path}`
	})
export const collectionBodySchema = z
	.object({
		name: z.string().trim().min(1).max(120),
		slug: collectionSlugSchema,
		description: z.string().trim().min(1).max(300),
		content: z.string().max(100_000),
		kind: z.enum(collectionKinds),
		sourceRepositoryUrl: sourceRepositorySchema.nullable(),
		mainProjectId: z.uuid().nullable(),
		status: z.enum(['draft', 'published']),
		projectIds: z
			.array(z.uuid())
			.max(100)
			.refine(
				(ids) => new Set(ids).size === ids.length,
				'Each member can appear only once.'
			),
	})
	.strict()
	.superRefine((value, ctx) => {
		if (
			value.kind === 'repository'
				? !value.sourceRepositoryUrl || value.mainProjectId !== null
				: !value.mainProjectId || value.sourceRepositoryUrl !== null
		) {
			ctx.addIssue({
				code: 'custom',
				message:
					'Curated lists require a source repository and no main project; alternatives and ecosystems require a listed main project and no source repository.',
			})
		}
		if (value.mainProjectId && value.projectIds.includes(value.mainProjectId)) {
			ctx.addIssue({
				code: 'custom',
				message: 'The main project cannot also be a member.',
			})
		}
		if (value.status === 'published' && value.projectIds.length === 0) {
			ctx.addIssue({
				code: 'custom',
				message: 'Published collections need at least one member.',
			})
		}
	})
export type CollectionBody = z.infer<typeof collectionBodySchema>
export const collectionProjectSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	slug: z.string(),
	description: z.string().nullable(),
	logo: z.string().nullable(),
	screenshot: z.string().nullable(),
	content: z.string().nullable(),
	websiteUrl: z.string().nullable(),
	repositoryUrl: z.string(),
})
export const collectionCardSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	slug: z.string(),
	description: z.string(),
	kind: z.enum(collectionKinds),
	logo: z.string().nullable(),
	updatedAt: z.coerce.date(),
	memberCount: z.number().int().nonnegative(),
})
export const collectionDetailSchema = collectionCardSchema
	.omit({ logo: true })
	.extend({
		content: z.string(),
		sourceRepositoryUrl: z.string().nullable(),
		authorName: z.string(),
		authorImage: z.string().nullable(),
		mainProject: collectionProjectSchema.nullable(),
		projects: z.array(collectionProjectSchema),
	})
export const adminCollectionSchema = collectionCardSchema
	.omit({ memberCount: true, logo: true })
	.extend({
		content: z.string(),
		sourceRepositoryUrl: z.string().nullable(),
		mainProjectId: z.uuid().nullable(),
		status: z.enum(['draft', 'published']),
		version: z.number().int(),
		authorName: z.string(),
		projects: z.array(collectionProjectSchema.extend({ status: z.string() })),
		mainProject: collectionProjectSchema
			.extend({ status: z.string() })
			.nullable(),
	})
export const collectionIdInput = z.object({
	params: z.object({ id: z.uuid() }),
})
export const collectionRevisionInput = z.object({
	params: z.object({ id: z.uuid() }),
	body: z.object({ expectedVersion: z.number().int().positive() }).strict(),
})
