import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { page } from 'vite-plus/test/browser'

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@altstack/ui/components/tooltip'

import { SponsorGrid } from '#/features/ads/components'
import { AdsContext } from '#/features/ads/context'
import { campaign, now } from '../ads-fixtures'
import '#/styles.css'

vi.mock('#/components/project-media', () => {
	return { ProjectLogo: () => null }
})
vi.mock('#/utils/storage', () => {
	return {
		resolveFileUrl: () =>
			'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
	}
})
afterEach(() => {
	cleanup()
	document.documentElement.classList.remove('dark')
})

describe('tooltip arrow surfaces', () => {
	it.each([false, true])(
		'matches the popup for default and sponsor tooltips (dark=%s)',
		async (dark) => {
			await page.viewport(1280, 900)
			if (dark) document.documentElement.classList.add('dark')
			const ad = campaign('sponsor')
			render(
				<TooltipProvider delay={0}>
					<Tooltip defaultOpen>
						<TooltipTrigger>Default trigger</TooltipTrigger>
						<TooltipContent>Default details</TooltipContent>
					</Tooltip>
					<AdsContext
						value={{ campaigns: [ad], selections: {}, entry: '/', now }}
					>
						<SponsorGrid />
					</AdsContext>
				</TooltipProvider>
			)
			await expect.element(page.getByText('Default details')).toBeVisible()
			const popup = document.querySelector<HTMLElement>(
				'[data-slot=tooltip-content]'
			)!
			const arrow = popup.querySelector<HTMLElement>(
				'[data-slot=tooltip-arrow]'
			)!
			expect(getComputedStyle(arrow).backgroundColor).toBe(
				getComputedStyle(popup).backgroundColor
			)
			expect(getComputedStyle(arrow).borderTopWidth).toBe('0px')
			await page
				.getByRole('link', { name: `Visit ${ad.name} (opens in a new tab)` })
				.hover()
			const sponsorPopup = await waitFor(() => {
				const content = Array.from(
					document.querySelectorAll<HTMLElement>('[data-slot=tooltip-content]')
				).find((element) => element.textContent === ad.description)
				expect(content).toBeDefined()
				return content!
			})
			await expect.element(page.elementLocator(sponsorPopup)).toBeVisible()
			const sponsorArrow = sponsorPopup.querySelector<HTMLElement>(
				'[data-slot=tooltip-arrow]'
			)!
			expect(getComputedStyle(sponsorArrow).backgroundColor).toBe(
				getComputedStyle(sponsorPopup).backgroundColor
			)
			expect(getComputedStyle(sponsorArrow).borderTopWidth).toBe('1px')
		}
	)
})
