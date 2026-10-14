import { ImageResponse } from '@vercel/og'

import advances from './assets/advances.json'
import glyphs from './assets/glyphs.json'

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630
export const homeHeadline = "discover open-source software you'll actually use."
export const homeSupporting =
	'find quality projects, compare alternatives, and explore developer tools.'

export interface GithubCardStats {
	owner: string
	repo: string
	stars: number
	forks: number
	fetchedAt: Date | string
}

type CardContent = {
	title: string
	description?: string | null
	fallback: string
}
export type SocialCard =
	| { kind: 'home' }
	| ({ kind: 'category' } & CardContent)
	| ({
			kind: 'project'
			logo?: string | null
			github?: GithubCardStats
	  } & CardContent)

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

function Symbol({
	size = 320,
	color = '#fff',
}: {
	size?: number
	color?: string
}) {
	return (
		<svg width={size} height={size} viewBox="0 0 256 256" fill={color}>
			<path d="M16 16H160V80H128L64 144V176H16Z" />
			<path d="M240 240H96V176H128L192 112V80H240Z" />
		</svg>
	)
}

export function githubCount(count: number) {
	if (!Number.isSafeInteger(count) || count < 0) return null
	return new Intl.NumberFormat(
		'en-US',
		count >= 1_000_000 ? { notation: 'compact', maximumFractionDigits: 1 } : {}
	).format(count)
}

function StatIcon({ kind }: { kind: 'stars' | 'forks' }) {
	return (
		<svg
			width="28"
			height="28"
			viewBox="0 0 24 24"
			fill="none"
			stroke="#000"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			{kind === 'stars' ? (
				<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z" />
			) : (
				<g>
					<circle cx="6" cy="3" r="2" />
					<circle cx="18" cy="3" r="2" />
					<circle cx="12" cy="21" r="2" />
					<path d="M6 5v4a6 6 0 0 0 6 6m6-10v4a6 6 0 0 1-6 6v4" />
				</g>
			)}
		</svg>
	)
}

function ProjectCard({
	card,
	signature,
}: {
	card: Extract<SocialCard, { kind: 'project' }>
	signature: string
}) {
	const title = cardText(card.title, card.fallback)
	const titleSize = title.length > 65 ? 38 : title.length > 30 ? 48 : 60
	const snapshot = card.github ? new Date(card.github.fetchedAt) : null
	const known = snapshot !== null && Number.isFinite(snapshot.getTime())
	const stats =
		known && card.github
			? [
					{
						kind: 'stars' as const,
						label: 'GitHub stars',
						count: githubCount(card.github.stars),
					},
					{
						kind: 'forks' as const,
						label: 'Forks',
						count: githubCount(card.github.forks),
					},
				].filter((stat) => stat.count !== null)
			: []
	const repository = card.github
		? cardText(`${card.github.owner}/${card.github.repo}`)
		: ''
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
			<div
				style={{
					position: 'absolute',
					left: 904,
					top: 206,
					opacity: 0.035,
					display: 'flex',
				}}
			>
				<Symbol size={400} color="#000" />
			</div>
			<div
				style={{
					position: 'absolute',
					left: 64,
					top: 64,
					width: 96,
					height: 96,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					border: '1px solid #e5e5e5',
					borderRadius: 16,
					background: card.logo ? '#fff' : '#000',
					overflow: 'hidden',
				}}
			>
				{card.logo ? (
					<img
						alt="Project logo"
						src={card.logo}
						width={80}
						height={80}
						style={{ objectFit: 'contain' }}
					/>
				) : (
					<div
						style={{
							fontSize: 52,
							fontWeight: 500,
							color: '#fff',
							display: 'flex',
						}}
					>
						{title.at(0)?.toUpperCase()}
					</div>
				)}
			</div>
			<div
				style={{
					position: 'absolute',
					left: 184,
					top: 68,
					width: 690,
					display: 'flex',
					flexDirection: 'column',
					fontSize: titleSize,
					fontWeight: 500,
					lineHeight: 1.08,
					letterSpacing: -1.8,
				}}
			>
				{fitLines(title, 690, titleSize, 2).map((line, index) => (
					<div key={index} style={{ display: 'flex' }}>
						{line}
					</div>
				))}
			</div>
			<div
				style={{
					position: 'absolute',
					left: 936,
					top: 66,
					width: 200,
					display: 'flex',
					flexDirection: 'column',
					gap: 20,
				}}
			>
				{stats.map((stat) => (
					<div
						key={stat.kind}
						style={{ display: 'flex', flexDirection: 'column', gap: 3 }}
					>
						<div
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: 10,
								fontSize: 32,
								fontWeight: 500,
							}}
						>
							<StatIcon kind={stat.kind} />
							{stat.count}
						</div>
						<div style={{ display: 'flex', fontSize: 18, paddingLeft: 38 }}>
							{stat.label}
						</div>
					</div>
				))}
			</div>
			<div
				style={{
					position: 'absolute',
					left: 64,
					top: 238,
					width: 1068,
					display: 'flex',
					flexDirection: 'column',
					fontSize: 40,
					lineHeight: 1.25,
					letterSpacing: -0.6,
				}}
			>
				{fitLines(cardText(card.description ?? ''), 1068, 40, 3).map(
					(line, index) => (
						<div key={index} style={{ display: 'flex' }}>
							{line}
						</div>
					)
				)}
			</div>
			<div
				style={{
					position: 'absolute',
					left: 64,
					top: 476,
					width: 1072,
					height: 1,
					background: '#ddd',
					display: 'flex',
				}}
			/>
			<img
				alt="altstack"
				src={signature}
				width={228}
				height={(228 * 256) / 1132}
				style={{ position: 'absolute', left: 60, top: 518 }}
			/>
			<div
				style={{
					position: 'absolute',
					left: 370,
					top: 514,
					width: 766,
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'flex-end',
					gap: 8,
				}}
			>
				{fitLines(repository, 750, 24, 1).map((line) => (
					<div key={line} style={{ display: 'flex', fontSize: 24 }}>
						{line}
					</div>
				))}
				{known && (
					<div style={{ display: 'flex', fontSize: 18 }}>
						GitHub snapshot · {snapshot.toISOString().slice(0, 10)}
					</div>
				)}
			</div>
		</div>
	)
}

export function cardLayout(card: SocialCard, signature: string) {
	if (card.kind === 'project') {
		return <ProjectCard card={card} signature={signature} />
	}
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
					{'explore the category'}
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
