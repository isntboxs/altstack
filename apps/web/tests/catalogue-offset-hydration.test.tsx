// @vitest-environment jsdom
import { act } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vite-plus/test'

import { ledgerKey } from '#/features/ads/selection'
import { useCatalogueOffset } from '#/features/ads/use-catalogue-offset'

function Offset({ catalogue }: { catalogue: string }) {
	return <output>{useCatalogueOffset(catalogue, 2)}</output>
}

describe('catalogue offset hydration', () => {
	it.each(['projects:{}', 'collections'])(
		'restores the %s ledger only after hydrating the server offset',
		async (catalogue) => {
			const key = ledgerKey(catalogue)
			sessionStorage.setItem(key, JSON.stringify({ 2: 42 }))
			const container = document.createElement('div')
			const recoverableError = vi.fn()
			let root: Root | undefined
			try {
				container.innerHTML = renderToString(<Offset catalogue={catalogue} />)
				expect(container.textContent).toBe('45')
				await act(() => {
					root = hydrateRoot(container, <Offset catalogue={catalogue} />, {
						onRecoverableError: recoverableError,
					})
					return Promise.resolve()
				})
				expect(container.textContent).toBe('42')
				expect(recoverableError).not.toHaveBeenCalled()
			} finally {
				act(() => root?.unmount())
				sessionStorage.removeItem(key)
			}
		}
	)
})
