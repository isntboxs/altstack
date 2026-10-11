import { describe, expect, it } from 'vite-plus/test'

import {
	githubCalendarDays,
	githubSnapshotDate,
	githubStarsWindow,
	shiftGithubDate,
} from '@altstack/shared/lib/github-stars'

describe('GitHub daily calendar in Asia/Jakarta', () => {
	it.each([
		['2026-10-10T16:59:59Z', '2026-10-10'],
		['2026-10-10T17:00:00Z', '2026-10-11'],
		['2026-12-31T17:00:00Z', '2027-01-01'],
	])(
		'buckets %s as %s independent of the host timezone',
		(instant, expected) => {
			expect(githubSnapshotDate(new Date(instant))).toBe(expected)
		}
	)
	it('includes the boundary snapshot across month and leap-year boundaries', () => {
		expect(githubStarsWindow(new Date('2024-03-01T01:00:00Z'))).toEqual({
			timezone: 'Asia/Jakarta',
			windowStartDate: '2024-01-31',
			windowEndDate: '2024-03-01',
		})
		expect(githubCalendarDays('2024-01-31', '2024-03-01')).toBe(30)
		expect(shiftGithubDate('2027-01-01', -1)).toBe('2026-12-31')
	})
})
