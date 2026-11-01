// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { useAds } from '#/features/ads/context'
import { AdsProvider } from '#/features/ads/provider'
import { selectionKey } from '#/features/ads/selection'
import type { Selection } from '#/features/ads/selection'
import { campaign, now } from './ads-fixtures'
const mock = vi.hoisted(() => {
	return { entry: '/', list: vi.fn() }
})
vi.mock('#/utils/orpc', () => {
	return { client: { ads: { list: mock.list } } }
})
vi.mock('@tanstack/react-router', () => {
	return {
		useLocation: ({
			select,
		}: {
			select: (value: { pathname: string; searchStr: string }) => string
		}) => select({ pathname: mock.entry, searchStr: '' }),
	}
})
function Probe() {
	const ads = useAds('banner')
	return <output>{ads.map((ad) => ad.name).join(',') || 'no ad'}</output>
}
const clients: Array<QueryClient> = []
function tree(enabled = true) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } },
	})
	clients.push(client)
	return (
		<QueryClientProvider client={client}>
			<AdsProvider enabled={enabled}>
				<Probe />
			</AdsProvider>
		</QueryClientProvider>
	)
}
async function flush(ms = 0) {
	await act(async () => {
		await vi.advanceTimersByTimeAsync(ms)
	})
}
beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(now)
	sessionStorage.clear()
	mock.entry = '/'
	mock.list.mockReset().mockImplementation(() =>
		Promise.resolve({
			campaigns: [campaign('one'), campaign('two')],
			serverNow: new Date(),
		})
	)
	vi.spyOn(Math, 'random').mockReturnValue(0)
})
afterEach(() => {
	cleanup()
	for (const client of clients.splice(0)) client.clear()
	vi.useRealTimers()
	vi.restoreAllMocks()
})
describe('session selection boundary', () => {
	it('never swaps a stationary banner at TTL and rotates on the next navigation using the original timestamp', async () => {
		const view = render(tree())
		await flush()
		expect(screen.getByText('Test advertiser one')).toBeTruthy()
		const first = JSON.parse(
			sessionStorage.getItem(selectionKey('banner'))!
		) as Selection
		await flush(181000)
		expect(screen.getByText('Test advertiser one')).toBeTruthy()
		expect(
			(JSON.parse(sessionStorage.getItem(selectionKey('banner'))!) as Selection)
				.selectedAt
		).toBe(first.selectedAt)
		vi.mocked(Math.random).mockReturnValue(0.99)
		mock.entry = '/blogs'
		view.rerender(tree())
		await flush()
		expect(screen.getByText('Test advertiser two')).toBeTruthy()
	})
	it('restores selections through unmount/reload without renewing TTL', async () => {
		const view = render(tree())
		await flush()
		const first = sessionStorage.getItem(selectionKey('banner'))
		view.unmount()
		await flush(60000)
		render(tree())
		await flush()
		expect(screen.getByText('Test advertiser one')).toBeTruthy()
		expect(sessionStorage.getItem(selectionKey('banner'))).toBe(first)
	})
	it('removes expired and newly deactivated campaigns while the page remains open', async () => {
		mock.list.mockImplementation(() =>
			Promise.resolve({
				campaigns: [{ ...campaign('one'), endsAt: new Date(now + 2000) }],
				serverNow: new Date(),
			})
		)
		const view = render(tree())
		await flush()
		expect(screen.getByText('Test advertiser one')).toBeTruthy()
		await flush(2000)
		expect(screen.getByText('no ad')).toBeTruthy()
		view.unmount()
		sessionStorage.clear()
		mock.list.mockImplementation(() =>
			Promise.resolve({
				campaigns: [campaign('two')],
				serverNow: new Date(),
			})
		)
		render(tree())
		await flush()
		expect(screen.getByText('Test advertiser two')).toBeTruthy()
		mock.list.mockImplementation(() =>
			Promise.resolve({
				campaigns: [],
				serverNow: new Date(),
			})
		)
		await flush(5000)
		expect(screen.getByText('no ad')).toBeTruthy()
	})
	it('fails closed on inventory failure and makes no requests on private routes', async () => {
		mock.list.mockRejectedValue(new Error('blocked or offline'))
		const view = render(tree())
		await flush()
		expect(screen.getByText('no ad')).toBeTruthy()
		view.unmount()
		mock.list.mockClear()
		render(tree(false))
		await flush(10000)
		expect(mock.list).not.toHaveBeenCalled()
	})
})
