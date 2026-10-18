// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { publicProjectMentions } from '@altstack/api/queries/project-mentions'

import { contentLink } from '#/features/public-content/model'
import { prepareContent } from '#/features/public-content/prepare.server'
import * as shiki from '#/utils/shiki.bundle'

vi.mock('@altstack/api/queries/project-mentions', () => {
	return { publicProjectMentions: vi.fn() }
})
vi.mock('@altstack/env/web', () => {
	return { env: { VITE_APP_URL: 'https://altstack.test/base' } }
})
vi.mock('evlog', () => {
	return { log: { warn: vi.fn() } }
})

beforeEach(() => {
	vi.mocked(publicProjectMentions).mockReset().mockResolvedValue([])
})
afterEach(() => vi.restoreAllMocks())

describe('public Markdown preparation', () => {
	it('collects explicit and reference links once, skipping images, code, external and reserved routes', async () => {
		vi.mocked(publicProjectMentions).mockResolvedValue([
			{ slug: 'supabase', name: 'Supabase', logo: null },
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
			supabase: { slug: 'supabase', name: 'Supabase', logo: null },
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
