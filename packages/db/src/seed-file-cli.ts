import dotenv from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { Pool } from 'pg'

import { relations } from '@altstack/db/relations'

import { createSeedGithubClient } from './seed-file-github'
import { importSeedFiles } from './seed-file-import'
import { readSeedFiles } from './seed-file-parser'

const usage = `Pemakaian: vp run db:seed:file -- --projects ./data/projects.csv --categories ./data/categories.csv
  --projects <file.csv|file.json>    Impor project
  --categories <file.csv|file.json>  Impor kategori
  --github                          Ambil statistik dan README project baru
  --dry-run                         Validasi dan hitung rencana tanpa menulis
  --help                            Tampilkan bantuan
Minimal satu path wajib diberikan. Path relatif terhadap direktori pemanggil.`

export function parseSeedFileArgs(args: Array<string>, cwd = process.cwd()) {
	const { values } = parseArgs({
		args: args[0] === '--' ? args.slice(1) : args,
		options: {
			projects: { type: 'string' },
			categories: { type: 'string' },
			github: { type: 'boolean', default: false },
			'dry-run': { type: 'boolean', default: false },
			help: { type: 'boolean', default: false },
		},
		strict: true,
		allowPositionals: false,
	})
	if (!values.help && !values.projects && !values.categories) {
		throw new Error('Minimal --projects atau --categories wajib diberikan')
	}
	for (const key of ['projects', 'categories'] as const) {
		if (values[key] !== undefined && !values[key].trim()) {
			throw new Error(`--${key} memerlukan path nonempty`)
		}
	}
	return {
		projects: values.projects ? resolve(cwd, values.projects) : undefined,
		categories: values.categories ? resolve(cwd, values.categories) : undefined,
		github: values.github,
		dryRun: values['dry-run'],
		help: values.help,
	}
}

export function loadSeedEnvironment(
	environment = process.env,
	envFile = fileURLToPath(new URL('../../../.env', import.meta.url))
) {
	dotenv.config({
		path: envFile,
		processEnv: environment,
		override: false,
		quiet: true,
	})
	if (!environment.DATABASE_URL) {
		throw new Error('DATABASE_URL wajib tersedia di environment atau .env root')
	}
	return environment
}

export async function runSeedFileCli(args = process.argv.slice(2)) {
	let pool: Pool | undefined
	try {
		const options = parseSeedFileArgs(args)
		if (options.help) {
			process.stdout.write(`${usage}\n`)
			return 0
		}
		const input = await readSeedFiles(options)
		const environment = loadSeedEnvironment()
		pool = new Pool({
			connectionString: environment.DATABASE_URL,
			connectionTimeoutMillis: 10_000,
		})
		const database = drizzle({ client: pool, relations })
		const summary = await importSeedFiles(database, input, {
			dryRun: options.dryRun,
			github: options.github
				? createSeedGithubClient(environment.GITHUB_TOKEN)
				: undefined,
		})
		process.stdout.write(
			summary.dryRun
				? 'Dry-run: rencana valid, tidak ada penulisan.\n'
				: 'Impor selesai.\n'
		)
		for (const [label, count] of [
			['Kategori', summary.categories],
			['Path kategori', summary.paths],
			['Project', summary.projects],
			['Metadata GitHub', summary.githubRepositories],
			['Relasi', summary.relations],
		] as const) {
			process.stdout.write(
				`${label}: dibuat=${count.created}, dilewati=${count.skipped}\n`
			)
		}
		for (const warning of summary.warnings) {
			process.stderr.write(`Peringatan: ${warning}\n`)
		}
		return 0
	} catch (error) {
		// Do not dump connection configuration or credentials on failure.
		process.stderr.write(
			`Impor gagal: ${error instanceof Error ? error.message : 'Kesalahan tidak diketahui'}\n`
		)
		return 1
	} finally {
		await pool?.end()
	}
}

if (import.meta.main) process.exitCode = await runSeedFileCli()
