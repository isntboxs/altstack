import { describe, expect, it } from 'vite-plus/test'

import { buildGithubStarsHistory } from '@altstack/api/queries/github-stars'

import { githubStarsWindow } from '@altstack/shared/lib/github-stars'

const window = githubStarsWindow(new Date('2026-10-11T02:00:00+07:00'))
const point = (date: string, stars: number) => {
	return {
		date,
		stars,
		observedAt: new Date(`${date}T02:00:00+07:00`),
	}
}

describe('observed total-star comparison', () => {
	it('waits for two observations, without inventing a zero baseline', () => {
		expect(buildGithubStarsHistory(window, []).comparison).toBeNull()
		expect(
			buildGithubStarsHistory(window, [point('2026-10-11', 100)]).comparison
		).toBeNull()
	})
	it('uses actual endpoints for partial history, gaps, and stale endpoints', () => {
		const points = [point('2026-10-02', 100), point('2026-10-07', 110)]
		expect(buildGithubStarsHistory(window, points)).toMatchObject({
			points,
			comparison: {
				days: 5,
				fromDate: '2026-10-02',
				toDate: '2026-10-07',
				deltaStars: 10,
				deltaPercent: 10,
			},
		})
	})
	it.each([
		[100, 90, -10, -10],
		[100, 0, -100, -100],
		[0, 20, 20, null],
		[0, 0, 0, null],
		[100, 100, 0, 0],
	])(
		'compares %s → %s across the full 30-day boundaries',
		(first, last, absolute, percent) => {
			expect(
				buildGithubStarsHistory(window, [
					point('2026-09-11', first),
					point('2026-10-11', last),
				]).comparison
			).toMatchObject({ days: 30, deltaStars: absolute, deltaPercent: percent })
		}
	)
})
