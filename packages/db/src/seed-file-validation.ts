import { z } from 'zod'

import { PROJECT_STATUS } from '@altstack/shared/constants'
import { publishProjectSchema } from '@altstack/shared/schemas/admin-project'
import {
	repositoryUrlSchema,
	projectSlugSchema,
	slugSchema,
} from '@altstack/shared/schemas/common'
import {
	projectLogoKeySchema,
	projectScreenshotKeySchema,
} from '@altstack/shared/schemas/upload'

export interface SeedSource {
	file: string
	location: string
}

export interface SeedRecord<T> {
	source: SeedSource
	value: T
}

export class SeedFileError extends Error {
	constructor(messages: Array<string>) {
		super(messages.join('\n'))
		this.name = 'SeedFileError'
	}
}

export function failSeed(
	source: SeedSource,
	field: string,
	reason: string
): never {
	throw new SeedFileError([
		`${source.file}: ${source.location}: ${field}: ${reason}`,
	])
}

const httpUrl = z.url({ protocol: /^https?$/ })
export const seedCategorySchema = z.strictObject({
	name: z.string().trim().min(2).max(100),
	slug: slugSchema,
	description: z.string().trim().min(1).max(300),
	parentSlug: slugSchema.optional(),
})

export const seedProjectSchema = z.strictObject({
	name: z.string().trim().min(2).max(100),
	slug: projectSlugSchema,
	repositoryUrl: repositoryUrlSchema,
	tagline: z.string().trim().max(100).optional(),
	description: z.string().trim().max(300).optional(),
	logo: z
		.union([httpUrl, projectLogoKeySchema], {
			error: 'Gunakan URL HTTP(S) atau final logo key valid; tmp/* ditolak',
		})
		.optional(),
	screenshot: z
		.union([httpUrl, projectScreenshotKeySchema], {
			error:
				'Gunakan URL HTTP(S) atau final screenshot key valid; tmp/* ditolak',
		})
		.optional(),
	websiteUrl: httpUrl.optional(),
	content: z.string().optional(),
	status: z.enum(PROJECT_STATUS).default('draft'),
	categorySlugs: z
		.array(slugSchema)
		.transform((values) => [...new Set(values)])
		.pipe(z.array(z.string()).max(3))
		.default([]),
})

export type SeedCategory = z.infer<typeof seedCategorySchema>
export type SeedProject = z.infer<typeof seedProjectSchema>
export type SeedKind = 'projects' | 'categories'
export interface SeedInput {
	projects: Array<SeedRecord<SeedProject>>
	categories: Array<SeedRecord<SeedCategory>>
}

function validationMessages(source: SeedSource, error: z.ZodError) {
	return error.issues.flatMap((issue) => {
		const fields =
			issue.code === 'unrecognized_keys'
				? issue.keys
				: [issue.path.map(String).join('.') || '$record']
		return fields.map(
			(field) =>
				`${source.file}: ${source.location}: ${field}: ${issue.message}`
		)
	})
}

export function validateSeedRecord<T>(
	record: SeedRecord<unknown>,
	schema: z.ZodType<T>
): SeedRecord<T> {
	const parsed = schema.safeParse(record.value)
	if (!parsed.success) {
		throw new SeedFileError(validationMessages(record.source, parsed.error))
	}
	return { source: record.source, value: parsed.data }
}

export function validatePublication(record: SeedRecord<SeedProject>) {
	if (record.value.status !== 'published') return
	const result = publishProjectSchema.safeParse(record.value)
	if (!result.success) {
		throw new SeedFileError(validationMessages(record.source, result.error))
	}
}

export function validateSeedIdentities(input: SeedInput) {
	function unique<T>(
		records: Array<SeedRecord<T>>,
		field: string,
		key: (value: T) => string
	) {
		const seen = new Map<string, SeedSource>()
		for (const record of records) {
			const identity = key(record.value)
			const first = seen.get(identity)
			if (first) {
				failSeed(
					record.source,
					field,
					`Identitas duplikat "${identity}" (pertama: ${first.file}, ${first.location})`
				)
			}
			seen.set(identity, record.source)
		}
	}
	unique(input.categories, 'slug', (value) => value.slug)
	unique(input.projects, 'slug', (value) => value.slug)
	unique(input.projects, 'repositoryUrl', (value) => value.repositoryUrl)
}
