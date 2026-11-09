// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { publicCollectionMentions } from '@altstack/api/queries/collection'
import { publicProjectMentions } from '@altstack/api/queries/project-mentions'

import { contentLink } from '#/features/public-content/model'
import { prepareContent } from '#/features/public-content/prepare.server'
import * as shiki from '#/utils/shiki.bundle'

vi.mock('@altstack/api/queries/project-mentions', () => {
	return { publicProjectMentions: vi.fn() }
})
vi.mock('@altstack/api/queries/collection', () => {
	return { publicCollectionMentions: vi.fn() }
})
vi.mock('@altstack/env/web', () => {
	return { env: { VITE_APP_URL: 'https://altstack.test/base' } }
})
vi.mock('evlog', () => {
	return { log: { warn: vi.fn() } }
})

beforeEach(() => {
	vi.mocked(publicProjectMentions).mockReset().mockResolvedValue([])
	vi.mocked(publicCollectionMentions).mockReset().mockResolvedValue([])
})
afterEach(() => vi.restoreAllMocks())

describe('public Markdown preparation', () => {
	it('batches collection links separately and ignores code, images, external hosts and nested collection paths', async () => {
		const collection = {
			slug: 'frontend',
			name: 'Frontend tools',
			description: 'Tools for the web',
			kind: 'ecosystem' as const,
			memberCount: 3,
			logo: null,
		}
		vi.mocked(publicCollectionMentions).mockResolvedValue([collection])
		const result = await prepareContent({
			slug: 'source',
			content: [
				'[one](/collections/frontend?ref=docs#members) [two](https://altstack.test/collections/frontend/)',
				'[ref][tools] [missing](/collections/missing) [project](/vite)',
				'[![badge](a.png)](/collections/image) [external](https://other.test/collections/external)',
				'`[code](/collections/code)` [nested](/collections/frontend/edit)',
				'[tools]: /collections/frontend',
			].join('\n\n'),
		})
		expect(publicCollectionMentions).toHaveBeenCalledExactlyOnceWith([
			'frontend',
			'missing',
		])
		expect(publicProjectMentions).toHaveBeenCalledExactlyOnceWith(['vite'])
		expect(result.collectionsBySlug).toEqual({ frontend: collection })
	})

	it('keeps project metadata when collection resolution fails', async () => {
		vi.mocked(publicCollectionMentions).mockRejectedValue(new Error('offline'))
		const project = {
			slug: 'vite',
			name: 'Vite',
			logo: null,
			tagline: null,
			verified: false,
			stars: 1,
			forks: 0,
		}
		vi.mocked(publicProjectMentions).mockResolvedValue([project])
		const result = await prepareContent({
			slug: 'source',
			content: '[Vite](/vite) [Collection](/collections/frontend)',
		})
		expect(result.projectsBySlug).toEqual({ vite: project })
		expect(result.collectionsBySlug).toEqual({})
	})
	it('collects explicit and reference links once, skipping images, code, external and reserved routes', async () => {
		vi.mocked(publicProjectMentions).mockResolvedValue([
			{
				slug: 'supabase',
				verified: false,
				name: 'Supabase',
				logo: null,
				tagline: 'An open-source backend.',
				stars: 83_335,
				forks: 8_847,
			},
		])
		const result = await prepareContent({
			slug: 'source',
			content: [
				'[one](/supabase?ref=docs#setup) [two](https://altstack.test/supabase/)',
				'[reference][DB] [missing](/missing) [external](https://other.test/external)',
				'[badge](/categories) [![image](a.png)](/image-project)',
				'`[code](/code-project)` [relative](relative-file)',
				'[db]: /supabase',
			].join('\n\n'),
		})
		expect(publicProjectMentions).toHaveBeenCalledExactlyOnceWith([
			'supabase',
			'missing',
		])
		expect(result.projectsBySlug).toEqual({
			supabase: {
				slug: 'supabase',
				verified: false,
				name: 'Supabase',
				logo: null,
				tagline: 'An open-source backend.',
				stars: 83_335,
				forks: 8_847,
			},
		})
	})

	it('highlights with both themes and preserves code including tabs and trailing blank lines', async () => {
		const code = '\tconst value = "<script>";  \n\n'
		const content = `Intro\n\n\`\`\`ts\n${code}\n\`\`\``
		const result = await prepareContent({ slug: 'source', content })
		const block = result.codeBlocks[content.indexOf('```')]
		expect(block.code).toBe(code)
		expect(
			block.tokens
				?.map((line) => line.map((token) => token.content).join(''))
				.join('\n')
		).toBe(code)
		expect(
			block.tokens
				?.flat()
				.some((token) => token.light.color !== token.dark.color)
		).toBe(true)
		expect(block.colors?.light.bgColor).not.toBe(block.colors?.dark.bgColor)
		expect(JSON.parse(JSON.stringify(result))).toEqual(result)
	})

	it('keeps unknown and indented code readable and retains highlighting when metadata fails', async () => {
		vi.mocked(publicProjectMentions).mockRejectedValue(
			new Error('database unavailable')
		)
		const result = await prepareContent({
			slug: 'source',
			content:
				'```unknown\nraw <tag>\n```\n\n    indented\n\n```js\nconst x = 1\n```\n\n[db](/supabase)',
		})
		const blocks = Object.values(result.codeBlocks)
		expect(blocks[0]).toEqual({ code: 'raw <tag>', language: 'unknown' })
		expect(blocks[1]).toEqual({ code: 'indented', language: 'text' })
		expect(blocks[2].tokens?.length).toBeGreaterThan(0)
		expect(result.projectsBySlug).toEqual({})
	})

	it.each(['powershell', 'ps1'] as const)(
		'loads %s on demand for editor and public highlighting',
		async (language) => {
			const code = '$name = "AltStack"\nWrite-Host $name -ForegroundColor Green'
			const highlighter = await shiki.createHighlighter({
				themes: [shiki.CODE_BLOCK_SHIKI_THEME],
				langs: [],
			})
			try {
				await highlighter.loadLanguage(language)
				const { tokens } = highlighter.codeToTokens(code, {
					lang: language,
					theme: shiki.CODE_BLOCK_SHIKI_THEME,
				})
				expect(
					new Set(tokens.flat().map((token) => token.color)).size
				).toBeGreaterThan(1)
			} finally {
				highlighter.dispose()
			}

			const result = await prepareContent({
				slug: 'source',
				content: `\`\`\`${language}\n${code}\n\`\`\``,
			})
			const block = result.codeBlocks[0]
			expect(block.language).toBe(language)
			expect(
				block.tokens
					?.map((line) => line.map((token) => token.content).join(''))
					.join('\n')
			).toBe(code)
			expect(
				new Set(block.tokens?.flat().map((token) => token.light.color)).size
			).toBeGreaterThan(1)
			expect(
				new Set(block.tokens?.flat().map((token) => token.dark.color)).size
			).toBeGreaterThan(1)
		}
	)

	it('falls back per block when the highlighter fails', async () => {
		vi.spyOn(shiki, 'getSingletonHighlighter').mockRejectedValueOnce(
			new Error('grammar unavailable')
		)
		const result = await prepareContent({
			slug: 'source',
			content: '```ts\nlet x = 1\n```',
		})
		expect(result.codeBlocks[0]).toEqual({ code: 'let x = 1', language: 'ts' })
	})

	it.each(['javascript:alert(1)', 'data:text/html,hello', '#section'])(
		'leaves %s out of project resolution',
		(href) => {
			expect(contentLink(href, 'source', 'https://altstack.test')).toBeNull()
		}
	)
	it.each([
		'https://altstack.test.evil/project',
		'//other.test/project',
		'/categories',
		'/projects/create',
	])('does not treat %s as a project mention', (href) => {
		expect(
			contentLink(href, 'source', 'https://altstack.test')?.projectSlug
		).toBeUndefined()
	})
})
