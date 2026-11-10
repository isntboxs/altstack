import c from '@shikijs/langs/c'
import css from '@shikijs/langs/css'
import graphql from '@shikijs/langs/graphql'
import haml from '@shikijs/langs/haml'
import html from '@shikijs/langs/html'
import javascript from '@shikijs/langs/javascript'
import lua from '@shikijs/langs/lua'
import shellscript from '@shikijs/langs/shellscript'
import sql from '@shikijs/langs/sql'
import xml from '@shikijs/langs/xml'
import yaml from '@shikijs/langs/yaml'
import type { LanguageRegistration } from '@shikijs/types'
import ruby from 'tm-grammars/grammars/ruby.json?raw'

// Shiki's Ruby entry also bundles C++ for heredocs. Load the grammar without it.
const language: LanguageRegistration = {
	...(JSON.parse(ruby) as LanguageRegistration),
	aliases: ['rb'],
	embeddedLangs: [
		'html',
		'haml',
		'xml',
		'sql',
		'graphql',
		'css',
		'c',
		'javascript',
		'shellscript',
		'lua',
		'yaml',
	],
}

export default [
	...html,
	...haml,
	...xml,
	...sql,
	...graphql,
	...css,
	...c,
	...javascript,
	...shellscript,
	...lua,
	...yaml,
	language,
]
