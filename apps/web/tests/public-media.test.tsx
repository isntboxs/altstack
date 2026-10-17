// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { ProjectLogo, ProjectScreenshot } from '#/components/project-media'

vi.mock('@altstack/env/web', () => {
	return {
		env: { VITE_S3_PUBLIC_URL: 'https://storage.test' },
	}
})
afterEach(cleanup)

describe('public project media', () => {
	it.each([null, 'https://project.test/'])(
		'keeps absent screenshots compact and unlinked with website %s',
		(websiteUrl) => {
			const view = render(
				<ProjectScreenshot src={null} name="Atlas" websiteUrl={websiteUrl} />
			)
			expect(screen.getByText('No screenshot available.')).toBeTruthy()
			expect(view.container.querySelector('img, a')).toBeNull()
		}
	)
	it.each([null, 'https://project.test/'])(
		'loads a stored screenshot independently of website %s',
		(websiteUrl) => {
			render(
				<ProjectScreenshot
					src="projects/atlas/screenshot.png"
					name="Atlas"
					websiteUrl={websiteUrl}
				/>
			)
			const img = screen.getByRole('img', { name: 'Screenshot of Atlas' })
			expect(img.getAttribute('src')).toBe(
				'https://storage.test/projects/atlas/screenshot.png'
			)
			expect(screen.getByText('Loading screenshot…')).toBeTruthy()
			fireEvent.load(img)
			expect(screen.queryByText('Loading screenshot…')).toBeNull()
			const link = screen.queryByRole('link')
			expect(link?.getAttribute('href') ?? null).toBe(websiteUrl)
			expect(link?.getAttribute('rel') ?? null).toBe(
				websiteUrl ? 'noopener noreferrer' : null
			)
		}
	)
	it('replaces failed screenshots without retrying and resets on source replacement', () => {
		const view = render(
			<ProjectScreenshot
				src="broken.png"
				name="Atlas"
				websiteUrl="https://project.test"
			/>
		)
		fireEvent.error(screen.getByRole('img'))
		expect(screen.getByText('Screenshot unavailable')).toBeTruthy()
		expect(view.container.querySelector('img, a')).toBeNull()
		view.rerender(
			<ProjectScreenshot src="replacement.png" name="Atlas" websiteUrl={null} />
		)
		expect(screen.queryByText('Screenshot unavailable')).toBeNull()
		expect(screen.getByRole('img').getAttribute('src')).toContain(
			'replacement.png'
		)
		fireEvent.load(screen.getByRole('img'))
		expect(screen.queryByText('Loading screenshot…')).toBeNull()
	})
	it('retains decorative initials for absent/broken logos and accepts a replacement source', () => {
		const view = render(<ProjectLogo src={null} name="Atlas Stack" />)
		expect(screen.getByText('AS').getAttribute('aria-hidden')).toBe('true')
		view.rerender(<ProjectLogo src="broken.png" name="Atlas Stack" />)
		fireEvent.error(view.container.querySelector('img')!)
		expect(screen.getByText('AS')).toBeTruthy()
		expect(view.container.querySelector('img')).toBeNull()
		view.rerender(<ProjectLogo src="fixed.png" name="Atlas Stack" />)
		expect(view.container.querySelector('img')?.getAttribute('alt')).toBe('')
		expect(view.container.querySelector('img')?.getAttribute('src')).toContain(
			'fixed.png'
		)
	})
})
