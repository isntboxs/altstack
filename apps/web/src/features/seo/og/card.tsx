import { ImageResponse } from '@vercel/og'

import advances from './assets/advances.json'
import glyphs from './assets/glyphs.json'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630
export const homeHeadline = "discover open-source software you'll actually use."
export const homeSupporting =
	'find quality projects, compare alternatives, and explore developer tools.'

export type SocialCard =
	| { kind: 'home' }
	| {
			kind: 'project' | 'category'
			title: string
			description?: string | null
			fallback: string
	  }

export interface CardResources {
	regular: Buffer
	medium: Buffer
	signature: string
}

const supported = new Set(glyphs)
// No network font/emoji fallback: @vercel/og otherwise downloads missing glyphs.
// Inter covers Latin, Greek and Cyrillic. Other scripts use the public slug.
export function cardText(value: string, fallback = '') {
	const clean = (text: string) =>
		Array.from(text.normalize('NFC').slice(0, 1200))
			.filter(
				(char) =>
					supported.has(char) &&
					!/[\p{Extended_Pictographic}\p{Cf}]/u.test(char)
			)
			.join('')
			.replace(/\s+/g, ' ')
			.trim()
	const text = clean(value)
	return /[\p{L}\p{N}]/u.test(text) ? text : clean(fallback)
}

// Conservative glyph advances keep even unbroken names inside the text grid.
// Explicit lines make fitting independent of browser CSS line-clamp support.
export function fitLines(
	text: string,
	width: number,
	size: number,
	max: number
) {
	const widths: Record<string, number> = advances
	const measure = (part: string) =>
		Array.from(part).reduce(
			(total, char) => total + (widths[char] ?? 1) * size,
			0
		)
	const lines: Array<string> = []
	let line = ''
	for (const word of text.split(' ')) {
		if (line && measure(`${line} ${word}`) > width) {
			lines.push(line)
			line = ''
		}
		for (const char of Array.from(word)) {
			if (measure(line + char) > width) {
				lines.push(line)
				line = ''
			}
			line += char
		}
		line += ' '
	}
	if (line.trim()) lines.push(line.trim())
	if (lines.length <= max) return lines.map((value) => value.trim())
	const result = lines.slice(0, max).map((value) => value.trim())
	let last = result[max - 1]
	while (last && measure(last + '…') > width) {
		last = Array.from(last).slice(0, -1).join('')
	}
	result[max - 1] = last.trim() + '…'
	return result
}

function Symbol() {
	return (
		<svg width="320" height="320" viewBox="0 0 256 256" fill="#fff">
			<path d="M16 16H160V80H128L64 144V176H16Z" />
			<path d="M240 240H96V176H128L192 112V80H240Z" />
		</svg>
	)
}

export function cardLayout(card: SocialCard, signature: string) {
	const home = card.kind === 'home'
	const title = home ? homeHeadline : cardText(card.title, card.fallback)
	const size = home ? 64 : title.length > 65 ? 48 : title.length > 35 ? 60 : 76
	const lines = home
		? ['discover open-source', "software you'll", 'actually use.']
		: fitLines(title, 778, size, 3)
	const description = home ? homeSupporting : cardText(card.description ?? '')
	const supportingLines = home
		? [
				'find quality projects, compare alternatives,',
				'and explore developer tools.',
			]
		: fitLines(description, 770, 25, 2)
	return (
		<div
			style={{
				width: OG_WIDTH,
				height: OG_HEIGHT,
				display: 'flex',
				background: '#fff',
				color: '#000',
				fontFamily: 'Inter',
				position: 'relative',
				overflow: 'hidden',
			}}
		>
			<img
				alt="altstack"
				src={signature}
				width={254}
				height={(254 * 256) / 1132}
				style={{ position: 'absolute', left: 60, top: 52 }}
			/>
			<div
				style={{
					position: 'absolute',
					left: 928,
					top: 0,
					width: 272,
					height: 630,
					display: 'flex',
					background: '#000',
					alignItems: 'center',
					justifyContent: 'center',
					overflow: 'hidden',
				}}
			>
				<div style={{ display: 'flex', width: 320, flexShrink: 0 }}>
					<Symbol />
				</div>
			</div>
			{!home && (
				<div
					style={{
						position: 'absolute',
						left: 64,
						top: 164,
						fontSize: 20,
						display: 'flex',
					}}
				>
					{card.kind === 'project'
						? 'open-source software'
						: 'explore the category'}
				</div>
			)}
			<div
				style={{
					position: 'absolute',
					left: 64,
					top: home ? 198 : 216,
					width: 800,
					display: 'flex',
					flexDirection: 'column',
					fontSize: size,
					fontWeight: 500,
					lineHeight: 1.09,
					letterSpacing: -2.6,
				}}
			>
				{lines.map((line, index) => (
					<div key={index} style={{ display: 'flex' }}>
						{line}
					</div>
				))}
			</div>
			<div
				style={{
					position: 'absolute',
					left: 64,
					top: home ? 508 : 490,
					width: 790,
					fontSize: 25,
					lineHeight: 1.3,
					display: 'flex',
					flexDirection: 'column',
				}}
			>
				{supportingLines.map((line, index) => (
					<div key={index} style={{ display: 'flex' }}>
						{line}
					</div>
				))}
			</div>
		</div>
	)
}

export async function renderCard(card: SocialCard, resources: CardResources) {
	const response = new ImageResponse(cardLayout(card, resources.signature), {
		width: OG_WIDTH,
		height: OG_HEIGHT,
		fonts: [
			{ name: 'Inter', data: resources.regular, weight: 400, style: 'normal' },
			{ name: 'Inter', data: resources.medium, weight: 500, style: 'normal' },
		],
	})
	// Consume the stream here so rendering failures become controlled HTTP errors.
	return new Uint8Array(await response.arrayBuffer())
}
