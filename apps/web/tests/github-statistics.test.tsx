// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterOutputs } from '@altstack/api/routers'

import { GithubStatistics } from '#/features/project/components/github-statistics'
import { githubElapsed, githubFullDate } from '#/features/project/github-time'

const history: ORPCRouterOutputs['project']['getBySlug']['githubStarsHistory'] =
	{
		timezone: 'Asia/Jakarta',
		windowStartDate: '2026-09-10',
		windowEndDate: '2026-10-10',
		points: [],
		comparison: null,
	}

const now = Date.parse('2026-10-10T12:00:00Z')
const github: ORPCRouterOutputs['project']['getBySlug']['github'] = {
	owner: 'owner',
	repo: 'repo',
	stars: 12345,
	forks: 1234,
	fetchedAt: new Date('2026-10-10T11:00:00Z'),
	metadataFetchedAt: new Date('2026-10-10T11:00:00Z'),
	lastCommitAt: new Date('2026-10-10T03:00:00Z'),
	repositoryCreatedAt: new Date('2024-10-10T12:00:00Z'),
	latestReleaseTag: 'v1.2.3',
}
afterEach(() => {
	cleanup()
	vi.useRealTimers()
})

describe('GitHub aside statistics', () => {
	it('marks statistics stale after 36 hours without changing the stored refresh time', () => {
		const { rerender } = render(
			<GithubStatistics
				history={history}
				github={github}
				now={github.fetchedAt.getTime() + 36 * 60 * 60 * 1000}
			/>
		)
		expect(screen.queryByText('Data may be outdated')).toBeNull()
		rerender(
			<GithubStatistics
				history={history}
				github={github}
				now={github.fetchedAt.getTime() + 36 * 60 * 60 * 1000 + 1}
			/>
		)
		expect(screen.getByText('Data may be outdated')).toBeTruthy()
	})
	it('formats relative commit, completed calendar age, version and refreshed time with UTC full-date tooltips', () => {
		render(<GithubStatistics history={history} github={github} now={now} />)
		expect(screen.getByText('12,345')).toBeTruthy()
		expect(screen.getByText('1,234')).toBeTruthy()
		expect(screen.getByText('9 hours ago').title).toBe(
			githubFullDate(github.lastCommitAt!)
		)
		expect(screen.getByText('2 years').title).toBe(
			githubFullDate(github.repositoryCreatedAt!)
		)
		expect(screen.getByText('v1.2.3')).toBeTruthy()
		expect(screen.getByText('Last refreshed 1 hour ago').title).toContain('UTC')
	})
	it('labels legacy/never-fetched metadata as Unknown', () => {
		render(
			<GithubStatistics
				history={history}
				github={{
					...github,
					lastCommitAt: null,
					repositoryCreatedAt: null,
					latestReleaseTag: null,
					metadataFetchedAt: null,
				}}
				now={now}
			/>
		)
		expect(screen.getAllByText('Unknown')).toHaveLength(3)
		expect(screen.queryByText('No commits')).toBeNull()
		expect(screen.queryByText('No releases')).toBeNull()
	})
	it('distinguishes successfully fetched empty repos and missing releases', () => {
		render(
			<GithubStatistics
				history={history}
				github={{ ...github, lastCommitAt: null, latestReleaseTag: null }}
				now={now}
			/>
		)
		expect(screen.getByText('No commits')).toBeTruthy()
		expect(screen.getByText('No releases')).toBeTruthy()
		expect(screen.getByText('2 years')).toBeTruthy()
	})
	it('hydrates exactly the server markup even when client clock and timezone differ', async () => {
		const element = (
			<GithubStatistics history={history} github={github} now={now} />
		)
		const originalTimezone = process.env.TZ
		process.env.TZ = 'UTC'
		const container = document.createElement('div')
		container.innerHTML = renderToString(element)
		document.body.append(container)
		const before = container.innerHTML
		process.env.TZ = 'Asia/Jakarta'
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(now + 24 * 60 * 60 * 1000)
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
			expect(container.textContent).toContain('9 hours ago')
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
	it.each([
		['2026-10-10T11:59:59Z', '1 second ago'],
		['2026-10-10T11:59:00Z', '1 minute ago'],
		['2026-10-09T12:00:00Z', '1 day ago'],
		['2026-09-10T12:00:00Z', '1 month ago'],
		['2025-10-10T12:00:00Z', '1 year ago'],
		['2026-10-11T12:00:00Z', '0 seconds ago'],
	])('formats %s without locale-dependent relative words', (date, expected) => {
		expect(githubElapsed(new Date(date), now, true)).toBe(expected)
	})
})
