// @vitest-environment jsdom
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { UserAvatar } from '#/components/user-avatar'
import { useGenerateAvatar } from '#/hooks/use-generate-avatar'

beforeEach(() => {
	vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
	vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(
		128
	)
})

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
})

describe('generated user avatars', () => {
	it.each([undefined, null, '', '   '])(
		'generates an avatar for image=%s using the name',
		async (image) => {
			const { result } = renderHook(() => useGenerateAvatar({ seed: 'Alice' }))
			render(<UserAvatar name="Alice" image={image} />)

			const avatar = await screen.findByRole('img', { name: 'Alice' })
			expect(avatar.getAttribute('src')).toBe(result.current)
			expect(result.current).toMatch(/^data:image\/svg\+xml/)
		}
	)

	it('preserves an existing profile photo', async () => {
		const image = 'https://example.com/alice.png'
		render(<UserAvatar name="Alice" image={image} />)

		expect(
			(await screen.findByRole('img', { name: 'Alice' })).getAttribute('src')
		).toBe(image)
	})

	it('produces a stable avatar for a name and updates when the name changes', () => {
		const { result, rerender } = renderHook(
			({ seed }) => useGenerateAvatar({ seed }),
			{ initialProps: { seed: 'Alice' } }
		)
		const aliceAvatar = result.current
		rerender({ seed: 'Bob' })
		expect(result.current).not.toBe(aliceAvatar)
		rerender({ seed: 'Alice' })
		expect(result.current).toBe(aliceAvatar)
	})

	it('supports both styles and updates when the style changes', () => {
		const { result, rerender } = renderHook(
			({ style }: { style: 'initialFace' | 'notionistsNeutral' }) =>
				useGenerateAvatar({ seed: 'Alice', style }),
			{ initialProps: { style: 'notionistsNeutral' } }
		)
		const notionistAvatar = result.current
		rerender({ style: 'initialFace' })
		expect(result.current).toMatch(/^data:image\/svg\+xml/)
		expect(result.current).not.toBe(notionistAvatar)
	})

	it('keeps initials available if the profile photo fails to load', () => {
		vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(
			0
		)
		render(<UserAvatar name="Alice" image="https://example.com/missing.png" />)

		expect(screen.getByText('AL')).toBeTruthy()
		expect(screen.queryByRole('img')).toBeNull()
	})
})
