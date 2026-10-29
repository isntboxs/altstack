import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vite-plus/test'

import { parseSeedFiles, parseSeedRecords } from '../src/seed-file-parser'

const project = {
	name: 'Example Tool',
	slug: 'example-tool',
	repositoryUrl: 'Owner/Repo',
}
const category = { name: 'Tools', slug: 'tools', description: 'Tools category' }
const projects = (value: unknown) =>
	parseSeedFiles({ file: 'projects.json', text: JSON.stringify(value) })

describe('CSV/JSON seed parser and validation', () => {
	it('rejects reserved project slugs while allowing the same category slug', () => {
		expect(() => projects([{ ...project, slug: 'Collections' }])).toThrow(
			/reserved/
		)
		expect(
			parseSeedFiles(undefined, {
				file: 'categories.json',
				text: JSON.stringify([{ ...category, slug: 'collections' }]),
			}).categories[0]?.value.slug
		).toBe('collections')
	})
	it('normalizes shared slugs and GitHub URLs, defaulting to draft and no assignments', () => {
		expect(
			projects([
				{
					...project,
					slug: 'Example Tool',
					repositoryUrl: 'HTTP://www.GitHub.com/Owner/Repo.git/tree/main?x=1',
				},
			]).projects[0]?.value
		).toMatchObject({
			slug: 'example-tool',
			repositoryUrl: 'https://github.com/owner/repo',
			status: 'draft',
			categorySlugs: [],
		})
	})
	it('supports BOM, blank lines, commas, escaped quotes, multiline content and pipe lists', () => {
		const input = parseSeedFiles({
			file: 'projects.csv',
			text: '\uFEFFname,slug,repositoryUrl,content,categorySlugs,status\r\n\r\n"Example, ""Tool""",example-tool,Owner/Repo,"# Hello\r\nSecond line", tools | libraries ,\r\n',
		})
		expect(input.projects[0]).toMatchObject({
			source: { file: 'projects.csv', location: 'baris 5' },
			value: {
				name: 'Example, "Tool"',
				content: '# Hello\r\nSecond line',
				categorySlugs: ['tools', 'libraries'],
				status: 'draft',
			},
		})
	})
	it('accepts JSON arrays, BOM, final media keys, HTTP media and category lists', () => {
		const result = parseSeedFiles({
			file: 'projects.json',
			text:
				'\uFEFF' +
				JSON.stringify([
					{
						...project,
						logo: 'projects/example-tool/logo-00000000-0000-0000-0000-000000000001.png',
						screenshot: 'https://example.com/screen.png',
						categorySlugs: ['tools'],
					},
				]),
		})
		expect(result.projects[0]?.value.categorySlugs).toEqual(['tools'])
	})
	it('validates publication with the existing full-record schema', () => {
		expect(() => projects([{ ...project, status: 'published' }])).toThrow(
			/projects.json: index 0: tagline/
		)
		expect(() =>
			projects([
				{
					...project,
					status: 'published',
					tagline: 'A tool',
					description: 'Useful tool',
					logo: 'https://example.com/logo.svg',
					categorySlugs: ['tools'],
				},
			])
		).not.toThrow()
	})
	it.each([
		['name', { ...project, name: undefined }],
		['slug', { ...project, slug: undefined }],
		['repositoryUrl', { ...project, repositoryUrl: undefined }],
		[
			'repositoryUrl',
			{ ...project, repositoryUrl: 'https://gitlab.com/owner/repo' },
		],
		['logo', { ...project, logo: 'tmp/logos/example-123.png' }],
		[
			'screenshot',
			{ ...project, screenshot: 'tmp/screenshots/example-123.png' },
		],
		['logo', { ...project, logo: 'ftp://example.com/image.png' }],
		['websiteUrl', { ...project, websiteUrl: 'javascript:alert(1)' }],
		['categorySlugs', { ...project, categorySlugs: 'tools|libraries' }],
		[
			'categorySlugs',
			{ ...project, categorySlugs: ['one', 'two', 'three', 'four'] },
		],
		['status', { ...project, status: 'invalid' }],
		['unexpected', { ...project, unexpected: '' }],
	])('reports the file, JSON index and invalid %s field', (field, value) => {
		expect(() => projects([value])).toThrow(
			new RegExp(`projects.json: index 0: ${field}`)
		)
	})
	it('requires category description and rejects unknown category fields', () => {
		expect(() =>
			parseSeedFiles(undefined, {
				file: 'categories.json',
				text: '[{"name":"Tools","slug":"tools"}]',
			})
		).toThrow(/categories.json: index 0: description/)
		expect(() =>
			parseSeedFiles(undefined, {
				file: 'categories.json',
				text: JSON.stringify([{ ...category, parent: 'root' }]),
			})
		).toThrow(/index 0: parent/)
	})
	it.each([
		['projects.json', '{}', 'JSON harus berupa array'],
		['projects.json', '[{', 'JSON malformed'],
		['projects.json', '[null]', '$record'],
		['projects.xlsx', '', 'Ekstensi'],
		['projects.csv', '', '$header'],
		['projects.csv', 'name,slug\nTool,tool', 'repositoryUrl'],
		['projects.csv', 'name,slug,repositoryUrl,typo\n', 'typo'],
		['projects.csv', 'name,slug,slug,repositoryUrl\n', 'Header duplikat'],
		[
			'projects.csv',
			'name,slug,repositoryUrl\n"unclosed,tool,owner/repo',
			'Quote',
		],
		[
			'projects.csv',
			'name,slug,repositoryUrl\nTool,tool,owner/repo,extra',
			'columns',
		],
	])('rejects malformed %s input with a location', (file, text, reason) => {
		expect(() => parseSeedFiles({ file, text })).toThrow(reason)
		expect(() => parseSeedFiles({ file, text })).toThrow(
			new RegExp(`${file}: (baris|index)`)
		)
	})
	it('preserves multiline record locations in validation errors', () => {
		expect(() =>
			parseSeedFiles({
				file: 'projects.csv',
				text: 'name,slug,repositoryUrl,content\nTool,tool,,"first\nsecond"\n',
			})
		).toThrow(/projects.csv: baris 3: repositoryUrl/)
	})
	it('rejects duplicate normalized identities within each input file', () => {
		expect(() =>
			projects([project, { ...project, repositoryUrl: 'other/repo' }])
		).toThrow(/slug: Identitas duplikat/)
		expect(() =>
			projects([
				project,
				{
					...project,
					slug: 'other',
					repositoryUrl: 'https://github.com/OWNER/REPO.git',
				},
			])
		).toThrow(/repositoryUrl: Identitas duplikat/)
		expect(() =>
			parseSeedFiles(undefined, {
				file: 'categories.json',
				text: JSON.stringify([category, category]),
			})
		).toThrow(/slug: Identitas duplikat/)
	})
	it('parses every shipped CSV and JSON template', async () => {
		for (const extension of ['csv', 'json']) {
			const file = (kind: string) =>
				fileURLToPath(
					new URL(`../../../data/${kind}.${extension}`, import.meta.url)
				)
			const input = parseSeedFiles(
				{
					file: file('projects'),
					text: await readFile(file('projects'), 'utf8'),
				},
				{
					file: file('categories'),
					text: await readFile(file('categories'), 'utf8'),
				}
			)
			expect(input.projects).toHaveLength(1)
			expect(input.categories).toHaveLength(3)
		}
	})
	it('keeps parsing separate from record validation', () => {
		expect(
			parseSeedRecords('projects.json', '[{"slug":"x"}]', 'projects')[0]?.value
		).toEqual({ slug: 'x' })
	})
})
