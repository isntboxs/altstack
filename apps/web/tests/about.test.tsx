// @vitest-environment jsdom
import {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterProvider,
} from '@tanstack/react-router'
import { act } from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vite-plus/test'

import { defaultAboutPage } from '@altstack/shared/schemas'

import { AboutArticle } from '#/features/about/article'

vi.mock('@altstack/env/web', () => {
	return {
		env: {
			VITE_APP_URL: 'https://altstack.test',
			VITE_S3_PUBLIC_URL: 'https://storage.test',
		},
	}
})
vi.mock('#/features/public-content/server-function', () => {
	return {
		preparePublicContent: vi.fn(),
		preparePublicBlogContent: vi.fn(),
	}
})

describe('About public rendering', () => {
	it('renders safe article HTML on the server and hydrates without changing the initial output', async () => {
		const data = {
			...defaultAboutPage,
			content:
				'## Our purpose\n\nRead **our story**. [Browse](/categories).\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert(1))',
		}
		const root = createRootRoute({
			component: () => <AboutArticle page={data} />,
		})
		const router = createRouter({
			routeTree: root,
			history: createMemoryHistory({ initialEntries: ['/about'] }),
		})
		await router.load()
		const container = document.createElement('div')
		container.innerHTML = renderToString(<RouterProvider router={router} />)
		expect(container.querySelectorAll('h1')).toHaveLength(1)
		expect(container.querySelector('h1')?.textContent).toBe(data.title)
		expect(container.querySelector('h2')?.textContent).toContain('Our purpose')
		expect(container.querySelector('strong')?.textContent).toBe('our story')
		expect(container.querySelector('script')).toBeNull()
		expect(container.querySelector('[href^="javascript:"]')).toBeNull()
		const recoverable = vi.fn()
		let hydrated: ReturnType<typeof hydrateRoot> | undefined
		try {
			await act(() => {
				hydrated = hydrateRoot(container, <RouterProvider router={router} />, {
					onRecoverableError: recoverable,
				})
				return Promise.resolve()
			})
			expect(recoverable).not.toHaveBeenCalled()
		} finally {
			act(() => hydrated?.unmount())
		}
	})
})
