import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

import { loadSeedEnvironment, parseSeedFileArgs } from '../src/seed-file-cli'

describe('file seed CLI arguments and environment', () => {
	it('uses the caller directory for both paths and accepts the forwarding separator', () => {
		expect(
			parseSeedFileArgs(
				[
					'--',
					'--projects',
					'./data/projects.csv',
					'--categories',
					'../categories.json',
					'--github',
					'--dry-run',
				],
				'/caller'
			)
		).toEqual({
			projects: '/caller/data/projects.csv',
			categories: '/categories.json',
			github: true,
			dryRun: true,
			help: false,
		})
	})
	it('requires a path, rejects unknown flags, empty paths and missing option values', () => {
		for (const args of [
			[],
			['--dry-run'],
			['--unknown'],
			['--projects'],
			['--projects', ''],
			['--projects', '   '],
			['input.json'],
		]) {
			expect(() => parseSeedFileArgs(args)).toThrow(/.+/)
		}
		expect(parseSeedFileArgs(['--help']).help).toBe(true)
		expect(parseSeedFileArgs(['--categories', 'categories.json']).github).toBe(
			false
		)
	})
	it('loads only DATABASE_URL as a requirement without overriding caller environment', async () => {
		const folder = await mkdtemp(join(tmpdir(), 'seed-cli-env-'))
		try {
			const path = join(folder, '.env')
			await writeFile(
				path,
				'DATABASE_URL=postgres://root/example\nGITHUB_TOKEN=file-token\n'
			)
			const caller = {
				DATABASE_URL: 'postgres://caller/example',
				GITHUB_TOKEN: 'caller-token',
			}
			expect(loadSeedEnvironment(caller, path)).toEqual(caller)
			const empty: NodeJS.ProcessEnv = {}
			await writeFile(path, 'DATABASE_URL=postgres://root/example\n')
			expect(loadSeedEnvironment(empty, path)).toEqual({
				DATABASE_URL: 'postgres://root/example',
			})
			expect(() => loadSeedEnvironment({}, join(folder, 'missing'))).toThrow(
				'DATABASE_URL'
			)
		} finally {
			await rm(folder, { recursive: true, force: true })
		}
	})
})
