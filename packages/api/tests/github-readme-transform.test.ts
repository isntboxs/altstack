import { describe, expect, it, vi } from 'vite-plus/test'

import { normalizeGithubReadme } from '@altstack/api/github-readme'

const context = {
	repositoryUrl: 'https://github.com/owner/repo',
	path: 'docs/README.md',
	commitSha: '0123456789abcdef0123456789abcdef01234567',
}
const blob = `${context.repositoryUrl}/blob/${context.commitSha}`
const raw = `https://raw.githubusercontent.com/owner/repo/${context.commitSha}`

describe('GitHub README transformation', () => {
	it('resolves inline, reference, root-relative, parent and encoded paths while keeping queries and fragments', () => {
		const result = normalizeGithubReadme(
			'[local](guide.md?q=1#start) [root](/LICENSE) [parent](../src/a%20b.ts#L1) [anchor](#install) [ref][guide]\n\n[guide]: other%2Fguide.md?x=%2F#part\n\n![inline](./images/a%20b.png?raw=1#image) ![root](/logo.png) ![parent](../img.png) ![reference][image]\n\n[image]: images/ref.png?x=1#frag',
			context
		)
		for (const url of [
			`${blob}/docs/guide.md?q=1#start`,
			`${blob}/LICENSE`,
			`${blob}/src/a%20b.ts#L1`,
			`${blob}/docs/README.md#install`,
			`${blob}/docs/other%2Fguide.md?x=%2F#part`,
			`${raw}/docs/images/a%20b.png?raw=1#image`,
			`${raw}/logo.png`,
			`${raw}/img.png`,
			`${raw}/docs/images/ref.png?x=1#frag`,
		]) {
			expect(result.markdown).toContain(url)
		}
		expect(result.warnings).toEqual([])
	})
	it('never escapes the pinned repository root through parent paths', () => {
		expect(
			normalizeGithubReadme('[up](../../../../LICENSE)', context).markdown
		).toContain(`${blob}/LICENSE`)
	})
	it('uses the real README directory and encodes its source path only once', () => {
		const result = normalizeGithubReadme('[self](#top) ![icon](../logo.png)', {
			...context,
			path: 'doc space/README%.md',
		})
		expect(result.sourceUrl).toBe(`${blob}/doc%20space/README%25.md`)
		expect(result.markdown).toContain(`${blob}/doc%20space/README%25.md#top`)
		expect(result.markdown).toContain(`${raw}/logo.png`)
	})
	it('keeps supported text, headings, lists, GFM tables, task lists, strikethrough and code without rewriting code URLs', () => {
		const input =
			'# Heading\n\n**bold** *emphasis* ~~old~~\n\n- one\n- two\n\n1. first\n2. second\n\n- [x] done\n- [ ] todo\n\n| Name | Value |\n| --- | --- |\n| A | B |\n\n`./inline.png`\n\n```ts\nconst url = "../image.png"\nconst html = "<script>code only</script>"\n```'
		const result = normalizeGithubReadme(input, context)
		for (const text of [
			'# Heading',
			'**bold**',
			'*emphasis*',
			'~~old~~',
			'- one',
			'1. first',
			'- [x] done',
			'- [ ] todo',
			'| Name | Value |',
			'`./inline.png`',
			'```ts',
			'const url = "../image.png"',
			'<script>code only</script>',
		]) {
			expect(result.markdown).toContain(text)
		}
		expect(result.warnings).toEqual([])
	})
	it('converts basic HTML to Markdown with layout warnings and pinned HTML links and images', () => {
		const result = normalizeGithubReadme(
			'<div align="center" style="color:red"><h2>Title</h2><p><strong>Bold</strong> <em>Italic</em> <a href="./guide.md">Guide</a><br>next</p><img src="../logo.png" width="100" alt="Logo"></div>',
			context
		)
		for (const text of [
			'## Title',
			'**Bold**',
			'*Italic*',
			`[Guide](${blob}/docs/guide.md)`,
			`![Logo](${raw}/logo.png)`,
		]) {
			expect(result.markdown).toContain(text)
		}
		expect(result.markdown).not.toContain('<div')
		expect(result.markdown).not.toContain('style=')
		expect(result.warnings.join(' ')).toMatch(/HTML.*alignment.*layout/)
	})
	it('removes scripts, iframes, SVG, event handlers, unsafe links and data images without fetching anything', () => {
		const fetch = vi
			.spyOn(globalThis, 'fetch')
			.mockRejectedValue(new Error('External fetching forbidden'))
		try {
			const result = normalizeGithubReadme(
				'<script>alert(1)</script><iframe src="https://evil.example"></iframe><svg><text>unsafe svg</text></svg>\n\n<a href="jav&#x61;script:alert(2)" onclick="evil()">safe text</a> <img src="data:image/png;base64,AAAA" onerror="evil()" alt="Unsafe image">\n\n[unsafe](vbscript:evil) [email](mailto:hello@example.com) ![email image](mailto:hello@example.com) ![ok](https://image.example/a.png) [ok](https://site.example)',
				context
			)
			for (const unsafe of [
				'<script',
				'alert(',
				'<iframe',
				'<svg',
				'unsafe svg',
				'javascript:',
				'vbscript:',
				'data:',
				'onerror',
				'onclick',
			]) {
				expect(result.markdown).not.toContain(unsafe)
			}
			expect(result.markdown).toContain('safe text')
			expect(result.markdown).toContain('[email](mailto:hello@example.com)')
			expect(result.markdown).not.toContain('![email image]')
			expect(result.warnings.join(' ')).toContain('Unsafe')
			expect(fetch).not.toHaveBeenCalled()
		} finally {
			fetch.mockRestore()
		}
	})
})
