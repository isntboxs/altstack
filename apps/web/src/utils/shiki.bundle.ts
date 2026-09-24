import {
	createBundledHighlighter,
	createSingletonShorthands,
} from '@shikijs/core'
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript'
import oneDarkProTheme from '@shikijs/themes/one-dark-pro'
/* Generate by @shikijs/codegen */
import type {
	DynamicImportLanguageRegistration,
	DynamicImportThemeRegistration,
	HighlighterGeneric,
	ThemedToken,
	ThemeRegistration,
} from '@shikijs/types'

export const CODE_BLOCK_SHIKI_THEME = 'altstack-code-dark'

type BundledLanguage =
	| 'angular-html'
	| 'angular-ts'
	| 'astro'
	| 'c'
	| 'cpp'
	| 'c++'
	| 'csharp'
	| 'c#'
	| 'cs'
	| 'css'
	| 'csv'
	| 'dart'
	| 'docker'
	| 'dockerfile'
	| 'dotenv'
	| 'git-commit'
	| 'git-rebase'
	| 'go'
	| 'graphql'
	| 'gql'
	| 'html'
	| 'hxml'
	| 'java'
	| 'javascript'
	| 'js'
	| 'cjs'
	| 'mjs'
	| 'json'
	| 'json5'
	| 'jsonc'
	| 'jsonl'
	| 'jsx'
	| 'kotlin'
	| 'kt'
	| 'kts'
	| 'latex'
	| 'lua'
	| 'luau'
	| 'markdown'
	| 'md'
	| 'mdc'
	| 'mdx'
	| 'mermaid'
	| 'mmd'
	| 'nginx'
	| 'php'
	| 'plsql'
	| 'postcss'
	| 'prisma'
	| 'python'
	| 'py'
	| 'ruby'
	| 'rb'
	| 'rust'
	| 'rs'
	| 'sass'
	| 'scss'
	| 'shellscript'
	| 'bash'
	| 'sh'
	| 'shell'
	| 'zsh'
	| 'sql'
	| 'svelte'
	| 'swift'
	| 'toml'
	| 'tsv'
	| 'tsx'
	| 'typescript'
	| 'ts'
	| 'cts'
	| 'mts'
	| 'vue-html'
	| 'xml'
	| 'yaml'
	| 'yml'
	| 'zig'
type BundledTheme =
	| 'one-dark-pro'
	| 'one-light'
	| 'github-light'
	| 'github-dark'
	| typeof CODE_BLOCK_SHIKI_THEME
type Highlighter = HighlighterGeneric<BundledLanguage, BundledTheme>

const CODE_BLOCK_BOLD_SCOPES = [
	'entity.name.function',
	'support.function',
	'support.function.any-method',
	'variable.function',
	'meta.function-call',
	'meta.function-call.generic',
	'meta.method',
	'meta.method-call',
	'meta.method.identifier',
	'keyword.other.special-method',
	'entity.name.type',
	'entity.name.type.class',
	'entity.name.class',
	'entity.name.namespace',
	'support.class',
	'support.type',
	'support.type.primitive',
	'support.type.builtin',
	'entity.other.inherited-class',
	'variable.other.class',
	'entity.name.tag',
	'entity.other.attribute-name',
] as const

export const SHIKI_BUNDLED_LANGUAGE_GROUPS = [
	{ id: 'angular-html', name: 'Angular HTML' },
	{ id: 'angular-ts', name: 'Angular TypeScript' },
	{ id: 'astro', name: 'Astro' },
	{ id: 'c', name: 'C' },
	{ id: 'cpp', name: 'C++', aliases: ['c++'] },
	{ id: 'csharp', name: 'C#', aliases: ['c#', 'cs'] },
	{ id: 'css', name: 'CSS' },
	{ id: 'csv', name: 'CSV' },
	{ id: 'dart', name: 'Dart' },
	{ id: 'dockerfile', name: 'Dockerfile', aliases: ['docker'] },
	{ id: 'dotenv', name: 'Dotenv' },
	{ id: 'git-commit', name: 'Git Commit' },
	{ id: 'git-rebase', name: 'Git Rebase' },
	{ id: 'go', name: 'Go' },
	{ id: 'graphql', name: 'GraphQL', aliases: ['gql'] },
	{ id: 'html', name: 'HTML' },
	{ id: 'hxml', name: 'HXML' },
	{ id: 'java', name: 'Java' },
	{ id: 'javascript', name: 'JavaScript', aliases: ['js', 'cjs', 'mjs'] },
	{ id: 'json', name: 'JSON' },
	{ id: 'json5', name: 'JSON5' },
	{ id: 'jsonc', name: 'JSONC' },
	{ id: 'jsonl', name: 'JSONL' },
	{ id: 'jsx', name: 'JSX' },
	{ id: 'kotlin', name: 'Kotlin', aliases: ['kt', 'kts'] },
	{ id: 'latex', name: 'LaTeX' },
	{ id: 'lua', name: 'Lua' },
	{ id: 'luau', name: 'Luau' },
	{ id: 'markdown', name: 'Markdown', aliases: ['md'] },
	{ id: 'mdc', name: 'MDC' },
	{ id: 'mdx', name: 'MDX' },
	{ id: 'mermaid', name: 'Mermaid', aliases: ['mmd'] },
	{ id: 'nginx', name: 'Nginx' },
	{ id: 'php', name: 'PHP' },
	{ id: 'plsql', name: 'PL/SQL' },
	{ id: 'postcss', name: 'PostCSS' },
	{ id: 'prisma', name: 'Prisma' },
	{ id: 'python', name: 'Python', aliases: ['py'] },
	{ id: 'ruby', name: 'Ruby', aliases: ['rb'] },
	{ id: 'rust', name: 'Rust', aliases: ['rs'] },
	{ id: 'sass', name: 'Sass' },
	{ id: 'scss', name: 'SCSS' },
	{
		id: 'shellscript',
		name: 'Shell',
		aliases: ['bash', 'sh', 'shell', 'zsh'],
	},
	{ id: 'sql', name: 'SQL' },
	{ id: 'svelte', name: 'Svelte' },
	{ id: 'swift', name: 'Swift' },
	{ id: 'toml', name: 'TOML' },
	{ id: 'tsv', name: 'TSV' },
	{ id: 'tsx', name: 'TSX' },
	{
		id: 'typescript',
		name: 'TypeScript',
		aliases: ['ts', 'cts', 'mts'],
	},
	{ id: 'vue-html', name: 'Vue HTML' },
	{ id: 'xml', name: 'XML' },
	{ id: 'yaml', name: 'YAML', aliases: ['yml'] },
	{ id: 'zig', name: 'Zig' },
] as const satisfies ReadonlyArray<{
	id: BundledLanguage
	name: string
	aliases?: ReadonlyArray<BundledLanguage>
}>

type ShikiLanguageGroupAlias =
	| (typeof SHIKI_BUNDLED_LANGUAGE_GROUPS)[number]['id']
	| ((typeof SHIKI_BUNDLED_LANGUAGE_GROUPS)[number] extends infer Group
			? Group extends { readonly aliases: ReadonlyArray<infer Alias> }
				? Alias
				: never
			: never)
type AssertNever<T extends never> = T
export type ShikiBundledLanguageCoverage = AssertNever<
	Exclude<BundledLanguage, ShikiLanguageGroupAlias>
>

const codeBlockShikiTheme = Object.freeze({
	...oneDarkProTheme,
	name: CODE_BLOCK_SHIKI_THEME,
	tokenColors: [
		...(oneDarkProTheme.tokenColors ?? []),
		{
			scope: [...CODE_BLOCK_BOLD_SCOPES],
			settings: {
				fontStyle: 'bold',
			},
		},
	],
}) satisfies ThemeRegistration

const bundledLanguages = {
	'angular-html': () => import('@shikijs/langs/angular-html'),
	'angular-ts': () => import('@shikijs/langs/angular-ts'),
	astro: () => import('@shikijs/langs/astro'),
	c: () => import('@shikijs/langs/c'),
	cpp: () => import('@shikijs/langs/cpp'),
	'c++': () => import('@shikijs/langs/cpp'),
	csharp: () => import('@shikijs/langs/csharp'),
	'c#': () => import('@shikijs/langs/csharp'),
	cs: () => import('@shikijs/langs/csharp'),
	css: () => import('@shikijs/langs/css'),
	csv: () => import('@shikijs/langs/csv'),
	dart: () => import('@shikijs/langs/dart'),
	docker: () => import('@shikijs/langs/docker'),
	dockerfile: () => import('@shikijs/langs/docker'),
	dotenv: () => import('@shikijs/langs/dotenv'),
	'git-commit': () => import('@shikijs/langs/git-commit'),
	'git-rebase': () => import('@shikijs/langs/git-rebase'),
	go: () => import('@shikijs/langs/go'),
	graphql: () => import('@shikijs/langs/graphql'),
	gql: () => import('@shikijs/langs/graphql'),
	html: () => import('@shikijs/langs/html'),
	hxml: () => import('@shikijs/langs/hxml'),
	java: () => import('@shikijs/langs/java'),
	javascript: () => import('@shikijs/langs/javascript'),
	js: () => import('@shikijs/langs/javascript'),
	cjs: () => import('@shikijs/langs/javascript'),
	mjs: () => import('@shikijs/langs/javascript'),
	json: () => import('@shikijs/langs/json'),
	json5: () => import('@shikijs/langs/json5'),
	jsonc: () => import('@shikijs/langs/jsonc'),
	jsonl: () => import('@shikijs/langs/jsonl'),
	jsx: () => import('@shikijs/langs/jsx'),
	kotlin: () => import('@shikijs/langs/kotlin'),
	kt: () => import('@shikijs/langs/kotlin'),
	kts: () => import('@shikijs/langs/kotlin'),
	latex: () => import('@shikijs/langs/latex'),
	lua: () => import('@shikijs/langs/lua'),
	luau: () => import('@shikijs/langs/luau'),
	markdown: () => import('@shikijs/langs/markdown'),
	md: () => import('@shikijs/langs/markdown'),
	mdc: () => import('@shikijs/langs/mdc'),
	mdx: () => import('@shikijs/langs/mdx'),
	mermaid: () => import('@shikijs/langs/mermaid'),
	mmd: () => import('@shikijs/langs/mermaid'),
	nginx: () => import('@shikijs/langs/nginx'),
	php: () => import('@shikijs/langs/php'),
	plsql: () => import('@shikijs/langs/plsql'),
	postcss: () => import('@shikijs/langs/postcss'),
	prisma: () => import('@shikijs/langs/prisma'),
	python: () => import('@shikijs/langs/python'),
	py: () => import('@shikijs/langs/python'),
	ruby: () => import('@shikijs/langs/ruby'),
	rb: () => import('@shikijs/langs/ruby'),
	rust: () => import('@shikijs/langs/rust'),
	rs: () => import('@shikijs/langs/rust'),
	sass: () => import('@shikijs/langs/sass'),
	scss: () => import('@shikijs/langs/scss'),
	shellscript: () => import('@shikijs/langs/shellscript'),
	bash: () => import('@shikijs/langs/shellscript'),
	sh: () => import('@shikijs/langs/shellscript'),
	shell: () => import('@shikijs/langs/shellscript'),
	zsh: () => import('@shikijs/langs/shellscript'),
	sql: () => import('@shikijs/langs/sql'),
	svelte: () => import('@shikijs/langs/svelte'),
	swift: () => import('@shikijs/langs/swift'),
	toml: () => import('@shikijs/langs/toml'),
	tsv: () => import('@shikijs/langs/tsv'),
	tsx: () => import('@shikijs/langs/tsx'),
	typescript: () => import('@shikijs/langs/typescript'),
	ts: () => import('@shikijs/langs/typescript'),
	cts: () => import('@shikijs/langs/typescript'),
	mts: () => import('@shikijs/langs/typescript'),
	'vue-html': () => import('@shikijs/langs/vue-html'),
	xml: () => import('@shikijs/langs/xml'),
	yaml: () => import('@shikijs/langs/yaml'),
	yml: () => import('@shikijs/langs/yaml'),
	zig: () => import('@shikijs/langs/zig'),
} as Record<BundledLanguage, DynamicImportLanguageRegistration>

const bundledThemes = {
	'one-dark-pro': () => import('@shikijs/themes/one-dark-pro'),
	'one-light': () => import('@shikijs/themes/one-light'),
	'github-light': () => import('@shikijs/themes/github-light-default'),
	'github-dark': () => import('@shikijs/themes/github-dark-default'),
	[CODE_BLOCK_SHIKI_THEME]: () =>
		Promise.resolve({
			default: codeBlockShikiTheme,
		}),
} as Record<BundledTheme, DynamicImportThemeRegistration>

function getFontStyleHtmlStyle(token: ThemedToken) {
	const htmlStyle = { ...token.htmlStyle }

	if (token.color) htmlStyle.color = token.color
	if (token.bgColor) htmlStyle['background-color'] = token.bgColor

	const fontStyle = token.fontStyle ?? 0

	if (fontStyle & 1) htmlStyle['font-style'] = 'italic'
	if (fontStyle & 2) htmlStyle['font-weight'] = '700'

	const textDecorations = []
	if (fontStyle & 4) textDecorations.push('underline')
	if (fontStyle & 8) textDecorations.push('line-through')
	if (textDecorations.length > 0) {
		htmlStyle['text-decoration'] = textDecorations.join(' ')
	}

	return Object.keys(htmlStyle).length > 0 ? htmlStyle : undefined
}

function applyFontStyleHtmlStyles(tokens: Array<Array<ThemedToken>>) {
	return tokens.map((line) =>
		line.map((token) => {
			const htmlStyle = getFontStyleHtmlStyle(token)

			return htmlStyle ? { ...token, htmlStyle } : token
		})
	)
}

export function withFontStyleHtmlStyles<
	Language extends string,
	Theme extends string,
>(highlighter: HighlighterGeneric<Language, Theme>) {
	return {
		...highlighter,
		codeToTokens(code, options) {
			const result = highlighter.codeToTokens(code, options)

			return {
				...result,
				tokens: applyFontStyleHtmlStyles(result.tokens),
			}
		},
		codeToTokensBase(code, options) {
			return applyFontStyleHtmlStyles(
				highlighter.codeToTokensBase(code, options)
			)
		},
	} satisfies HighlighterGeneric<Language, Theme>
}

const createHighlighter = /* @__PURE__ */ createBundledHighlighter<
	BundledLanguage,
	BundledTheme
>({
	langs: bundledLanguages,
	themes: bundledThemes,
	engine: () => createJavaScriptRegexEngine(),
})

const {
	codeToHtml,
	codeToHast,
	codeToTokensBase,
	codeToTokens,
	codeToTokensWithThemes,
	getSingletonHighlighter,
	getLastGrammarState,
} = /* @__PURE__ */ createSingletonShorthands<BundledLanguage, BundledTheme>(
	createHighlighter
)

export {
	bundledLanguages,
	bundledThemes,
	codeToHast,
	codeToHtml,
	codeToTokens,
	codeToTokensBase,
	codeToTokensWithThemes,
	createHighlighter,
	getLastGrammarState,
	getSingletonHighlighter,
}
export type { BundledLanguage, BundledTheme, Highlighter }
