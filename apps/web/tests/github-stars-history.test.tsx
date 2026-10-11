// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import type { GithubStarsHistory as History } from '@altstack/shared/schemas/project'

import { GithubStarsHistory } from '#/features/project/components/github-stars-history'

const point = (date: string, stars: number) => {
	return {
		date,
		stars,
		observedAt: new Date(`${date}T02:00:00+07:00`),
	}
}
const full: History = {
	timezone: 'Asia/Jakarta',
	windowStartDate: '2026-09-11',
	windowEndDate: '2026-10-11',
	points: [
		point('2026-09-11', 100),
		point('2026-09-12', 110),
		point('2026-10-11', 120),
	],
	comparison: {
		fromDate: '2026-09-11',
		toDate: '2026-10-11',
		days: 30,
		deltaStars: 20,
		deltaPercent: 20,
	},
}
afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
	vi.useRealTimers()
})

describe('GitHub star-history sparkline', () => {
	it('keeps the full date axis, breaks gaps, and exposes an accessible comparison', () => {
		const { container } = render(<GithubStarsHistory history={full} />)
		expect(screen.getByText('+20 (+20.0%)')).toBeTruthy()
		expect(screen.getByText('30-day change')).toBeTruthy()
		expect(screen.getByText('28 days without data')).toBeTruthy()
		expect(container.querySelectorAll('polyline')).toHaveLength(1)
		expect(container.querySelectorAll('circle')).toHaveLength(3)
		expect(
			container.querySelector('circle:last-child')?.getAttribute('cx')
		).toBe('296')
		expect(container.querySelector('svg')?.getAttribute('height')).toBe('64')
		expect(container.querySelector('svg')?.getAttribute('width')).toBe('100%')
		expect(
			screen
				.getByRole('button', { name: 'GitHub stars history' })
				.getAttribute('aria-describedby')
		).toBeTruthy()
	})
	it('labels empty, one-point, and partial/stale coverage truthfully', () => {
		const { rerender } = render(
			<GithubStarsHistory history={{ ...full, points: [], comparison: null }} />
		)
		expect(screen.getByText('No star history for this period')).toBeTruthy()
		expect(screen.queryByRole('button')).toBeNull()
		rerender(
			<GithubStarsHistory
				history={{
					...full,
					points: [point('2026-10-07', 100)],
					comparison: null,
				}}
			/>
		)
		expect(screen.getByText('Collecting daily history')).toBeTruthy()
		expect(screen.queryByText('30-day change')).toBeNull()
		rerender(
			<GithubStarsHistory
				history={{
					...full,
					points: [point('2026-10-02', 100), point('2026-10-07', 110)],
					comparison: {
						fromDate: '2026-10-02',
						toDate: '2026-10-07',
						days: 5,
						deltaStars: 10,
						deltaPercent: 10,
					},
				}}
			/>
		)
		expect(screen.getByText('Change over 5 days')).toBeTruthy()
		expect(screen.getByText('Oct 2, 2026 – Oct 7, 2026 (WIB)')).toBeTruthy()
		expect(screen.getByText('4 days without data')).toBeTruthy()
	})
	it.each([
		[-10, -10, '-10 (-10.0%)'],
		[20, null, '+20 (—)'],
		[0, 0, '0 (0.0%)'],
		[-1, -0.001, '-1 (0.0%)'],
	])(
		'formats signed growth and a zero baseline: %s/%s',
		(deltaStars, deltaPercent, expected) => {
			render(
				<GithubStarsHistory
					history={{
						...full,
						comparison: { ...full.comparison!, deltaStars, deltaPercent },
					}}
				/>
			)
			expect(screen.getByText(expected)).toBeTruthy()
		}
	)
	it('supports keyboard, pointer and tap without extra tab stops', () => {
		vi.stubGlobal('PointerEvent', MouseEvent)
		render(<GithubStarsHistory history={full} />)
		const graph = screen.getByRole('button', { name: 'GitHub stars history' })
		vi.spyOn(graph, 'getBoundingClientRect').mockReturnValue(
			new DOMRect(0, 0, 300, 64)
		)
		fireEvent.focus(graph)
		expect(screen.getByRole('tooltip').textContent).toContain(
			'Oct 11, 2026 (WIB) · 120 stars'
		)
		fireEvent.keyDown(graph, { key: 'ArrowLeft' })
		expect(screen.getByRole('status').textContent).toContain(
			'Sep 12, 2026 (WIB): 110 stars'
		)
		fireEvent.keyDown(graph, { key: 'Home' })
		expect(screen.getByRole('tooltip').textContent).toContain('Sep 11, 2026')
		fireEvent.keyDown(graph, { key: 'End' })
		expect(screen.getByRole('tooltip').textContent).toContain('Oct 11, 2026')
		fireEvent.keyDown(graph, { key: 'Escape' })
		expect(screen.queryByRole('tooltip')).toBeNull()
		fireEvent.pointerMove(graph, { clientX: 5 })
		expect(screen.getByRole('tooltip').textContent).toContain('Sep 11, 2026')
		fireEvent.pointerDown(graph, { pointerType: 'touch', clientX: 295 })
		expect(screen.getByRole('tooltip').textContent).toContain('Oct 11, 2026')
		expect(screen.getAllByRole('button')).toHaveLength(1)
		fireEvent.blur(graph)
		expect(screen.queryByRole('tooltip')).toBeNull()
	})
	it('renders a flat series and hydrates unchanged with a different clock and timezone', async () => {
		const flat = {
			...full,
			points: full.points.map((p) => {
				return { ...p, stars: 100 }
			}),
			comparison: { ...full.comparison!, deltaStars: 0, deltaPercent: 0 },
		}
		const element = <GithubStarsHistory history={flat} />
		const originalTimezone = process.env.TZ
		process.env.TZ = 'UTC'
		const container = document.createElement('div')
		container.innerHTML = renderToString(element)
		document.body.append(container)
		const before = container.innerHTML
		process.env.TZ = 'America/Los_Angeles'
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date('2027-01-01T00:00:00Z'))
		const recoverable = vi.fn()
		let root: ReturnType<typeof hydrateRoot> | undefined
		try {
			await act(async () => {
				root = hydrateRoot(container, element, {
					onRecoverableError: recoverable,
				})
				await Promise.resolve()
			})
			expect(recoverable).not.toHaveBeenCalled()
			expect(container.innerHTML).toBe(before)
			expect(
				[...container.querySelectorAll('circle')].map((circle) =>
					circle.getAttribute('cy')
				)
			).toEqual(['32', '32', '32'])
		} finally {
			await act(async () => {
				root?.unmount()
				await Promise.resolve()
			})
			container.remove()
			if (originalTimezone === undefined) delete process.env.TZ
			else process.env.TZ = originalTimezone
		}
	})
})
