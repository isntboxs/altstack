import { useId, useState } from 'react'
import type { PointerEvent } from 'react'

import { githubCalendarDays } from '@altstack/shared/lib/github-stars'
import type { GithubStarsHistory as StarsHistory } from '@altstack/shared/schemas/project'

const number = new Intl.NumberFormat('en-US')
const signedNumber = new Intl.NumberFormat('en-US', {
	signDisplay: 'exceptZero',
})
const percent = new Intl.NumberFormat('en-US', {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
	signDisplay: 'exceptZero',
})
const date = new Intl.DateTimeFormat('en-US', {
	timeZone: 'Asia/Jakarta',
	dateStyle: 'medium',
})
const time = new Intl.DateTimeFormat('en-US', {
	timeZone: 'Asia/Jakarta',
	dateStyle: 'medium',
	timeStyle: 'long',
})
const fullDate = (value: string) =>
	date.format(new Date(`${value}T00:00:00+07:00`))

export function GithubStarsHistory({ history }: { history: StarsHistory }) {
	const [activeIndex, setActiveIndex] = useState<number | null>(null)
	const id = useId()
	const { points, comparison, windowStartDate, windowEndDate } = history
	const active = activeIndex === null ? undefined : points[activeIndex]
	const values = points.map((point) => point.stars)
	const min = Math.min(...values)
	const max = Math.max(...values)
	const plotted = points.map((point) => {
		return {
			...point,
			x: 4 + (githubCalendarDays(windowStartDate, point.date) / 30) * 292,
			y: max === min ? 32 : 58 - ((point.stars - min) / (max - min)) * 52,
		}
	})
	// Start a new path after each missing calendar date; never fill the gap.
	const segments: Array<Array<(typeof plotted)[number]>> = []
	for (const point of plotted) {
		const segment = segments.at(-1)
		const previous = segment?.at(-1)
		if (
			segment &&
			previous &&
			githubCalendarDays(previous.date, point.date) === 1
		) {
			segment.push(point)
		} else segments.push([point])
	}
	const missing = comparison ? comparison.days + 1 - points.length : 0
	const fullPeriod =
		comparison?.fromDate === windowStartDate &&
		comparison.toDate === windowEndDate
	const roundedPercent =
		comparison?.deltaPercent === null || !comparison
			? null
			: Math.round(comparison.deltaPercent * 10) / 10
	const delta = comparison
		? `${signedNumber.format(comparison.deltaStars)} (${roundedPercent === null ? '—' : `${percent.format(roundedPercent === 0 ? 0 : roundedPercent)}%`})`
		: ''
	const period = comparison
		? fullPeriod
			? '30-day change'
			: `Change over ${comparison.days} days`
		: ''
	const range = comparison
		? `${fullDate(comparison.fromDate)} – ${fullDate(comparison.toDate)} (WIB)`
		: ''
	const summary = comparison
		? `${period}: ${delta}. ${range}. ${points.length} daily observations. ${missing} days without data.`
		: points.length === 1
			? 'One daily observation. Collecting daily history.'
			: 'No star history for this period.'
	const pointDescription = active
		? `${fullDate(active.date)} (WIB): ${number.format(active.stars)} stars. Observed ${time.format(active.observedAt)}.`
		: ''

	function selectNearest(event: PointerEvent<HTMLButtonElement>) {
		const rect = event.currentTarget.getBoundingClientRect()
		if (rect.width === 0) return
		const x = ((event.clientX - rect.left) / rect.width) * 300
		let nearest = 0
		for (let index = 1; index < plotted.length; index++) {
			if (Math.abs(plotted[index].x - x) < Math.abs(plotted[nearest].x - x)) {
				nearest = index
			}
		}
		setActiveIndex(nearest)
	}

	return (
		<div className="min-w-0 space-y-2 border-b border-border pb-3">
			{comparison && (
				<div className="space-y-0.5 text-xs">
					<p
						className={
							comparison.deltaStars > 0
								? 'font-medium text-emerald-600 dark:text-emerald-400'
								: comparison.deltaStars < 0
									? 'font-medium text-rose-600 dark:text-rose-400'
									: 'font-medium text-muted-foreground'
						}
					>
						{delta}
					</p>
					<p className="text-muted-foreground">{period}</p>
					{!fullPeriod && <p className="text-muted-foreground">{range}</p>}
				</div>
			)}
			<p id={`${id}-summary`} className="sr-only">
				{summary}
			</p>
			{points.length > 0 ? (
				<div className="relative min-w-0">
					<button
						type="button"
						className="block h-16 w-full cursor-crosshair rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						aria-label="GitHub stars history"
						aria-describedby={`${id}-summary ${id}-instructions`}
						onPointerMove={selectNearest}
						onPointerDown={selectNearest}
						onPointerLeave={(event) => {
							if (
								event.pointerType === 'mouse' &&
								event.currentTarget !== document.activeElement
							) {
								setActiveIndex(null)
							}
						}}
						onFocus={() =>
							setActiveIndex((previous) => previous ?? points.length - 1)
						}
						onBlur={() => setActiveIndex(null)}
						onClick={() =>
							setActiveIndex((previous) => previous ?? points.length - 1)
						}
						onKeyDown={(event) => {
							if (
								!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(
									event.key
								)
							) {
								return
							}
							event.preventDefault()
							if (event.key === 'Escape') setActiveIndex(null)
							else if (event.key === 'Home') setActiveIndex(0)
							else if (event.key === 'End') setActiveIndex(points.length - 1)
							else {
								setActiveIndex((previous) =>
									Math.max(
										0,
										Math.min(
											points.length - 1,
											(previous ?? points.length - 1) +
												(event.key === 'ArrowLeft' ? -1 : 1)
										)
									)
								)
							}
						}}
					>
						<svg
							width="100%"
							height="64"
							viewBox="0 0 300 64"
							preserveAspectRatio="none"
							aria-hidden="true"
							className="text-emerald-600 dark:text-emerald-400"
						>
							{segments
								.filter((segment) => segment.length > 1)
								.map((segment) => (
									<polyline
										key={segment[0].date}
										points={segment
											.map((point) => `${point.x},${point.y}`)
											.join(' ')}
										fill="none"
										stroke="currentColor"
										strokeWidth="1.5"
										vectorEffect="non-scaling-stroke"
									/>
								))}
							{plotted.map((point, index) => (
								<circle
									key={point.date}
									cx={point.x}
									cy={point.y}
									r={index === activeIndex ? 3 : 1.5}
									fill="currentColor"
								/>
							))}
						</svg>
					</button>
					{active && (
						<div
							role="tooltip"
							className="pointer-events-none absolute inset-x-0 bottom-full z-10 mb-2 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
						>
							<p className="font-medium">
								{fullDate(active.date)} (WIB) · {number.format(active.stars)}{' '}
								stars
							</p>
							<p className="mt-1 text-muted-foreground">
								Observed {time.format(active.observedAt)}
							</p>
						</div>
					)}
					<span id={`${id}-instructions`} className="sr-only">
						Use left and right arrows to select daily observations, Home and End
						for the first and last, and Escape to close the tooltip.
					</span>
					<output className="sr-only">{pointDescription}</output>
				</div>
			) : (
				<p className="py-4 text-xs text-muted-foreground">
					No star history for this period
				</p>
			)}
			<div className="space-y-0.5 text-xs text-muted-foreground">
				<p>Last 30 days</p>
				{points.length === 1 && <p>Collecting daily history</p>}
				{missing > 0 && (
					<p>
						{missing} {missing === 1 ? 'day' : 'days'} without data
					</p>
				)}
			</div>
		</div>
	)
}
