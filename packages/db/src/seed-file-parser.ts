import type { SeedInput, SeedKind, SeedRecord } from './seed-file-validation'
import { CsvError } from 'csv-parse'
import type { Info } from 'csv-parse'
import { parse } from 'csv-parse/sync'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

import {
	failSeed,
	seedCategorySchema,
	seedProjectSchema,
	validatePublication,
	validateSeedIdentities,
	validateSeedRecord,
} from './seed-file-validation'

// CSV locations identify the last physical line of a record, including multiline
// quoted values. JSON locations are zero-based array indexes.
export function parseSeedRecords(
	file: string,
	text: string,
	kind: SeedKind
): Array<SeedRecord<unknown>> {
	const extension = extname(file).toLowerCase()
	const document = { file, location: 'baris 1' }
	if (extension === '.json') {
		let value: unknown
		try {
			value = JSON.parse(text.replace(/^\uFEFF/, ''))
		} catch (error) {
			failSeed(
				document,
				'$file',
				`JSON malformed: ${error instanceof Error ? error.message : 'syntax error'}`
			)
		}
		if (!Array.isArray(value)) {
			failSeed(document, '$file', 'JSON harus berupa array record')
		}
		return value.map((record: unknown, index: number) => {
			return {
				source: { file, location: `index ${index}` },
				value: record,
			}
		})
	}
	if (extension !== '.csv') {
		failSeed(document, '$file', 'Ekstensi harus .csv atau .json')
	}
	const schema = kind === 'projects' ? seedProjectSchema : seedCategorySchema
	const allowed = Object.keys(schema.shape)
	const required =
		kind === 'projects'
			? ['name', 'slug', 'repositoryUrl']
			: ['name', 'slug', 'description']
	const headerState = { seen: false }
	try {
		const rows = parse<{ record: Record<string, string>; info: Info }>(text, {
			bom: true,
			trim: true,
			skip_empty_lines: true,
			info: true,
			columns: (headers: Array<string>) => {
				headerState.seen = true
				const seen = new Set<string>()
				for (const header of headers) {
					if (!allowed.includes(header)) {
						failSeed(document, header || '$header', 'Field tidak dikenal')
					}
					if (seen.has(header)) failSeed(document, header, 'Header duplikat')
					seen.add(header)
				}
				for (const field of required) {
					if (!seen.has(field)) {
						failSeed(document, field, 'Header wajib tidak tersedia')
					}
				}
				return headers
			},
		})
		if (!headerState.seen) {
			failSeed(document, '$header', 'CSV harus memiliki header')
		}
		return rows.map(({ record, info }) => {
			return {
				source: { file, location: `baris ${info.lines}` },
				value: Object.fromEntries(
					Object.entries(record).map(([field, value]) => [
						field,
						field === 'categorySlugs'
							? value.trim()
								? value.split('|').map((slug) => slug.trim())
								: []
							: value === '' && !required.includes(field)
								? undefined
								: value,
					])
				),
			}
		})
	} catch (error) {
		if (error instanceof CsvError) {
			failSeed(
				{
					file,
					location: `baris ${typeof error.lines === 'number' ? error.lines : 1}`,
				},
				typeof error.column === 'string' || typeof error.column === 'number'
					? String(error.column)
					: '$record',
				error.message
			)
		}
		throw error
	}
}

export function parseSeedFiles(
	projects?: { file: string; text: string },
	categories?: { file: string; text: string }
): SeedInput {
	const input: SeedInput = {
		projects: projects
			? parseSeedRecords(projects.file, projects.text, 'projects').map(
					(record) => validateSeedRecord(record, seedProjectSchema)
				)
			: [],
		categories: categories
			? parseSeedRecords(categories.file, categories.text, 'categories').map(
					(record) => validateSeedRecord(record, seedCategorySchema)
				)
			: [],
	}
	for (const record of input.projects) validatePublication(record)
	validateSeedIdentities(input)
	return input
}

export async function readSeedFiles(paths: {
	projects?: string
	categories?: string
}) {
	async function read(file?: string) {
		if (!file) return undefined
		try {
			return { file, text: await readFile(file, 'utf8') }
		} catch (error) {
			failSeed(
				{ file, location: 'baris 1' },
				'$file',
				error instanceof Error ? error.message : 'Tidak dapat membaca file'
			)
		}
	}
	const [projects, categories] = await Promise.all([
		read(paths.projects),
		read(paths.categories),
	])
	return parseSeedFiles(projects, categories)
}
