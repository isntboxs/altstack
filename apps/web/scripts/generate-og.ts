import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { renderCard } from '#/features/seo/og/card'

const assets = new URL('../src/features/seo/og/assets/', import.meta.url)
const resources = {
	regular: await readFile(new URL('inter-400.ttf', assets)),
	medium: await readFile(new URL('inter-500.ttf', assets)),
	signature:
		'data:image/svg+xml;base64,' +
		(await readFile(new URL('signature.svg', assets))).toString('base64'),
}
const output = new URL('../public/og/', import.meta.url)
await mkdir(output, { recursive: true })
await writeFile(
	new URL('default.png', output),
	await renderCard({ kind: 'home' }, resources)
)
console.debug('Generated 1200 × 630 default:', fileURLToPath(output))
