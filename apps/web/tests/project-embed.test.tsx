// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { ProjectEmbedDialog } from '#/features/project/components/project-embed-dialog'
import {
	badgeDefaults,
	badgeDimension,
	badgeParameters,
	badgeSnippet,
	projectDialogSearch,
} from '#/features/project/embed/badge'

vi.mock('@altstack/env/web', () => {
	return {
		env: { VITE_APP_URL: 'https://altstack.test/base?ignored=1' },
	}
})
afterEach(() => {
	cleanup()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})
function view() {
	return render(
		<ProjectEmbedDialog
			slug="atlas"
			name={'Atlas & "Friends" <Kit>'}
			open
			onOpenChange={vi.fn()}
			finalFocus={() => null}
		/>
	)
}
describe('shared badge contract', () => {
	it('defaults missing values, rejects ambiguous and malformed query parameters', () => {
		expect(badgeParameters(new URLSearchParams())).toEqual(badgeDefaults)
		expect(
			badgeParameters(new URLSearchParams('theme=light&width=1200&height=400'))
		).toEqual({ theme: 'light', width: 1200, height: 400 })
		for (const query of [
			'theme=auto',
			'theme=',
			'theme=dark&theme=light',
			'width=200&width=300',
			'height=',
			'width=1e3',
			'width=Infinity',
			'width=NaN',
			'width=-200',
			'width=200.5',
			'height=0',
			'width=1201',
		]) {
			expect(badgeParameters(new URLSearchParams(query))).toBeNull()
		}
	})
	it.each([
		'',
		' ',
		'NaN',
		'Infinity',
		'-200',
		'200.5',
		'1e3',
		'0x200',
		'159',
		'1201',
		'99999999',
	])('rejects editable invalid width %s', (value) => {
		expect(badgeDimension(value, 'width')).toBeNull()
	})
	it('escapes attributes and uses configured origin, project tracking and matching image size', () => {
		const html = badgeSnippet('atlas&"kit', 'Atlas & "Friends" <Kit>', {
			theme: 'light',
			width: 320,
			height: 80,
		})
		expect(html).toContain('&amp;')
		expect(html).toContain(
			'alt="Atlas &amp; &quot;Friends&quot; &lt;Kit&gt; badge"'
		)
		const doc = new DOMParser().parseFromString(html, 'text/html')
		const anchor = doc.querySelector('a')!
		const image = doc.querySelector('img')!
		const link = new URL(anchor.href)
		expect(link.origin).toBe('https://altstack.test')
		expect(Object.fromEntries(link.searchParams)).toEqual({
			utm_source: 'altstack',
			utm_medium: 'badge',
			utm_campaign: 'embed',
			utm_content: 'project-atlas&"kit',
		})
		expect(anchor.target).toBe('_blank')
		expect(anchor.rel).toBe('noopener noreferrer')
		expect(image.alt).toBe('Atlas & "Friends" <Kit> badge')
		expect(image.getAttribute('loading')).toBe('lazy')
		expect(image.width).toBe(320)
		expect(image.height).toBe(80)
		expect(new URL(image.src).search).toBe('?theme=light&width=320&height=80')
		expect(doc.querySelector('script')).toBeNull()
	})
	it('owns only the implemented dialog values and preserves unrelated search state', () => {
		for (const dialog of ['unknown', 1, ['embed'], null]) {
			expect(projectDialogSearch({ dialog, ref: 'docs' })).toEqual({
				dialog: undefined,
				ref: 'docs',
			})
		}
		expect(projectDialogSearch({ dialog: 'report', ref: 'docs' })).toEqual({
			dialog: 'report',
			ref: 'docs',
		})
		expect(
			projectDialogSearch({ dialog: 'embed', utm_source: 'badge' })
		).toEqual({ dialog: 'embed', utm_source: 'badge' })
	})
})
describe('Embed customization and copy', () => {
	it('starts dark 200×50 independently of app theme, previews real SVG, validates edits and recovers from image failure', () => {
		document.documentElement.classList.add('light')
		view()
		const image = screen.getByRole('img')
		expect(image.getAttribute('src')).toBe(
			'https://altstack.test/atlas/badge.svg?theme=dark&width=200&height=50'
		)
		expect(
			screen.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')
		).toBe('true')
		expect(screen.getByText('Loading badge…')).toBeTruthy()
		fireEvent.error(image)
		expect(screen.getByText(/Badge unavailable/)).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Light' }))
		fireEvent.load(screen.getByRole('img'))
		expect(screen.getByText('Badge loaded.')).toBeTruthy()
		fireEvent.change(screen.getByLabelText('Width'), { target: { value: '' } })
		expect(screen.getByLabelText('Width')).toHaveProperty('value', '')
		expect(screen.getByLabelText('Width').getAttribute('aria-invalid')).toBe(
			'true'
		)
		expect(screen.getByLabelText('Embed code')).toHaveProperty('value', '')
		expect(screen.getByRole('button', { name: 'Copy' })).toHaveProperty(
			'disabled',
			true
		)
		expect(screen.queryByRole('img')).toBeNull()
		fireEvent.change(screen.getByLabelText('Width'), {
			target: { value: '1200' },
		})
		expect(screen.getByRole('img').getAttribute('width')).toBe('1200')
		expect(screen.getByLabelText('Embed code')).toHaveProperty('readOnly', true)
	})
	it('reports success only after clipboard resolves and clears success on edits', async () => {
		let done: () => void = () => {
			throw new Error('Clipboard promise not initialized')
		}
		const writeText = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					done = resolve
				})
		)
		vi.stubGlobal('navigator', { clipboard: { writeText } })
		view()
		fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
		expect(screen.queryByText('Embed code copied to clipboard.')).toBeNull()
		expect(writeText).toHaveBeenCalledWith(
			screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Embed code' })
				.value
		)
		done()
		await screen.findByRole('button', { name: 'Copied' })
		fireEvent.change(screen.getByLabelText('Height'), {
			target: { value: '80' },
		})
		expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull()
	})
	it.each(['missing', 'rejected'])(
		'selects manual fallback after %s clipboard without claiming success',
		async (kind) => {
			vi.stubGlobal(
				'navigator',
				kind === 'missing'
					? {}
					: {
							clipboard: {
								writeText: vi.fn().mockRejectedValue(new Error('Denied')),
							},
						}
			)
			view()
			await waitFor(() =>
				expect(document.activeElement).toBe(
					screen.getByRole('button', { name: 'Dark' })
				)
			)
			fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
			await screen.findByText(/Copy failed/)
			const textarea = screen.getByRole<HTMLTextAreaElement>('textbox', {
				name: 'Embed code',
			})
			expect(document.activeElement).toBe(textarea)
			expect(textarea.selectionEnd - textarea.selectionStart).toBe(
				textarea.value.length
			)
			expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull()
		}
	)
	it('ignores a stale clipboard success after editing', async () => {
		let done: () => void = () => {
			throw new Error('Clipboard promise not initialized')
		}
		vi.stubGlobal('navigator', {
			clipboard: {
				writeText: () =>
					new Promise<void>((resolve) => {
						done = resolve
					}),
			},
		})
		view()
		fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
		fireEvent.change(screen.getByLabelText('Width'), {
			target: { value: '300' },
		})
		done()
		await waitFor(() =>
			expect(screen.getByRole('button', { name: 'Copy' })).toHaveProperty(
				'disabled',
				false
			)
		)
		expect(screen.queryByRole('button', { name: 'Copied' })).toBeNull()
	})
})
