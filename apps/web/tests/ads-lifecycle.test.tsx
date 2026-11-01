// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { AdCampaign } from '@altstack/shared/schemas/ads'

import {
	AdBanner,
	CornerAd,
	AdListingGrid,
	SponsorGrid,
} from '#/features/ads/components'
import { campaign } from './ads-fixtures'
const state = vi.hoisted(() => {
	return {
		ads: [] as Array<AdCampaign>,
	}
})
vi.mock('#/features/ads/context', () => {
	return {
		useAds: () => state.ads,
		useAdsEntry: () => '/',
	}
})
vi.mock('#/components/project-media', () => {
	return { ProjectLogo: () => null }
})
vi.mock('#/utils/storage', () => {
	return {
		resolveFileUrl: (key: string) => `https://assets.test/${key}`,
	}
})
beforeEach(() => {
	vi.useFakeTimers()
	sessionStorage.clear()
	state.ads = [campaign('one'), campaign('two')]
	vi.spyOn(Math, 'random').mockReturnValue(0)
	vi.stubGlobal('matchMedia', () => {
		return {
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		}
	})
})
afterEach(() => {
	cleanup()
	vi.useRealTimers()
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})
const advance = (ms: number) =>
	act(() => {
		vi.advanceTimersByTime(ms)
	})
describe('public ad interactions', () => {
	it('has one clickable banner link, a badge, and no nested anchors', () => {
		render(<AdBanner />)
		const link = screen.getByRole('link')
		expect(link.querySelector('a')).toBeNull()
		expect(link.getAttribute('rel')).toContain('sponsored')
		expect(screen.getByText('Ad')).toBeTruthy()
	})
	it('makes sponsor descriptions available through native touch/keyboard disclosure', () => {
		render(<SponsorGrid />)
		expect(screen.getAllByText(/About Test advertiser/)).toHaveLength(2)
		expect(document.querySelectorAll('details summary')).toHaveLength(2)
	})
	it('exits before swapping at 15 seconds and pauses for hover, keyboard focus and hidden tabs', () => {
		vi.mocked(Math.random)
			.mockReturnValueOnce(0)
			.mockReturnValueOnce(0.99)
			.mockReturnValue(0)
		render(<CornerAd />)
		advance(0)
		expect(screen.getByText('Test advertiser one')).toBeTruthy()
		advance(14800)
		expect(screen.getByRole('complementary').className).toContain(
			'ad-corner-leaving'
		)
		advance(200)
		expect(screen.getByText('Test advertiser two')).toBeTruthy()
		const corner = screen.getByRole('complementary')
		fireEvent.mouseEnter(corner)
		advance(60000)
		expect(screen.getByText('Test advertiser two')).toBeTruthy()
		fireEvent.mouseLeave(corner)
		fireEvent.focus(screen.getByRole('link'))
		advance(60000)
		expect(screen.getByText('Test advertiser two')).toBeTruthy()
		fireEvent.blur(screen.getByRole('link'), { relatedTarget: document.body })
		Object.defineProperty(document, 'hidden', {
			configurable: true,
			value: true,
		})
		fireEvent(document, new Event('visibilitychange'))
		advance(60000)
		expect(screen.getByText('Test advertiser two')).toBeTruthy()
		Object.defineProperty(document, 'hidden', {
			configurable: true,
			value: false,
		})
		fireEvent(document, new Event('visibilitychange'))
		advance(14999)
		expect(screen.getByText('Test advertiser two')).toBeTruthy()
		advance(1)
		expect(screen.getByText('Test advertiser one')).toBeTruthy()
	})
	it('offers explicit pause and keeps dismissal across route unmount/remount', () => {
		vi.mocked(Math.random).mockReturnValueOnce(0).mockReturnValue(0.99)
		const view = render(<CornerAd />)
		advance(0)
		fireEvent.click(screen.getByRole('button', { name: 'Pause ad rotation' }))
		advance(45000)
		expect(screen.getByText('Test advertiser one')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Resume ad rotation' }))
		advance(15000)
		expect(screen.getByText('Test advertiser two')).toBeTruthy()
		fireEvent.click(
			screen.getByRole('button', { name: 'Hide ads for this session' })
		)
		expect(screen.queryByRole('link')).toBeNull()
		view.unmount()
		render(<CornerAd />)
		expect(screen.queryByRole('link')).toBeNull()
	})
	it('backfills hidden ad cards without retrying advertisements or losing content order', () => {
		vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(
			function (this: HTMLElement) {
				return (this.dataset.adId === 'one'
					? []
					: [{}]) as unknown as DOMRectList
			}
		)
		state.ads = [campaign('one'), campaign('two'), campaign('three')]
		render(
			<AdListingGrid
				items={Array.from({ length: 45 }, (_, id) => {
					return { id: String(id) }
				})}
				renderItem={(item) => <p data-testid="content">{item.id}</p>}
				catalogue="test"
				page={1}
				offset={0}
			/>
		)
		expect(screen.getAllByTestId('content')).toHaveLength(43)
		expect(
			screen.getAllByTestId('content').map((el) => el.textContent)
		).toEqual(Array.from({ length: 43 }, (_, i) => String(i)))
		advance(3000)
		expect(screen.getAllByTestId('content')).toHaveLength(43)
	})
})
