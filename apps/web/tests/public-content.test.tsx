// @vitest-environment jsdom
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from '@tanstack/react-router'
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	within,
	waitFor,
} from '@testing-library/react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import { PublicContent } from '#/components/public-content'
import {
	emptyPublicContent,
	projectSlugFromPath,
} from '#/features/public-content/model'
import type { PreparedPublicContent } from '#/features/public-content/model'

vi.mock('@altstack/env/web', () => {
	return {
		env: {
			VITE_APP_URL: 'https://altstack.test',
			VITE_S3_PUBLIC_URL: 'https://storage.test',
		},
	}
})
vi.mock('#/features/public-content/server-function', () => {
	return { preparePublicContent: vi.fn() }
})

beforeEach(() => {
	vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})

it('does not turn reserved directory paths into project mentions', () => {
	for (const path of [
		'/collections',
		'/tags',
		'/bookmarks',
		'/admin',
		'/og',
		'/sitemaps',
	]) {
		expect(projectSlugFromPath(path)).toBeUndefined()
	}
	expect(projectSlugFromPath('/collections-project')).toBe(
		'collections-project'
	)
})
afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
})

async function documentRouter(
	content: string,
	prepared = emptyPublicContent()
) {
	const root = createRootRoute({ component: Outlet })
	const route = createRoute({
		getParentRoute: () => root,
		path: '$slug',
		component: () => (
			<PublicContent slug="source" content={content} prepared={prepared} />
		),
	})
	const router = createRouter({
		routeTree: root.addChildren([route]),
		history: createMemoryHistory({ initialEntries: ['/source'] }),
	})
	await router.load()
	return router
}

describe('public Markdown rendering', () => {
	it('renders GFM and safe headings while discarding raw HTML and executable URLs', async () => {
		const router = await documentRouter(
			'# Heading\n\n~~old~~ and `inline`\n\n- [x] Done\n\n| Name | Value |\n| --- | --- |\n| A | B |\n\n<script>alert(1)</script>\n\n[unsafe](javascript:alert(1))\n\n![unsafe](data:text/html,test)'
		)
		render(<RouterProvider router={router} />)
		const article = screen.getByRole('article')
		expect(within(article).getByRole('heading', { level: 2 }).textContent).toBe(
			'Heading'
		)
		expect(
			article.querySelector(
				'h1, script, a[href^="javascript:"], img[src^="data:"]'
			)
		).toBeNull()
		expect(article.querySelector('del')?.textContent).toBe('old')
		expect(article.querySelector('input')?.checked).toBe(true)
		expect(within(article).getByRole('table').textContent).toContain('Name')
		expect(article.querySelector('code')?.textContent).toBe('inline')
	})

	it('renders project chips, ordinary links and image badges with safe destinations', async () => {
		const prepared = emptyPublicContent()
		prepared.projectsBySlug.supabase = {
			slug: 'supabase',
			name: 'Supabase',
			logo: 'projects/supabase/logo.png',
			tagline: 'Build applications with an open-source backend.',
			stars: 83_335,
			forks: 8_847,
		}
		const router = await documentRouter(
			'[old name](/supabase?ref=docs#setup) [ref][db]\n\n[![badge](https://img.test/badge.svg)](/supabase)\n\n[missing](/missing) [categories](/categories) [section](#section) [website](https://example.com)\n\n[db]: https://altstack.test/supabase',
			prepared
		)
		render(<RouterProvider router={router} />)
		const chips = screen.getAllByRole('link', { name: 'Supabase' })
		expect(chips).toHaveLength(2)
		expect(document.querySelector('a a')).toBeNull()
		expect(chips[0].getAttribute('href')).toBe('/supabase?ref=docs#setup')
		expect(chips[0].querySelector('img')?.getAttribute('src')).toBe(
			'https://storage.test/projects/supabase/logo.png'
		)
		fireEvent.error(chips[0].querySelector('img')!)
		expect(chips[0].querySelector('img')).toBeNull()
		expect(chips[0].textContent).toContain('S')
		expect(
			screen
				.getByAltText('badge')
				.closest('a')
				?.hasAttribute('data-project-mention')
		).toBe(false)
		expect(
			screen.getByRole('link', { name: 'missing' }).getAttribute('href')
		).toBe('/missing')
		expect(
			screen.getByRole('link', { name: 'section' }).getAttribute('href')
		).toBe('#section')
		const external = screen.getByRole('link', {
			name: /website\s*\(opens in a new tab\)/,
		})
		expect(external.getAttribute('target')).toBe('_blank')
		expect(external.getAttribute('rel')).toBe('noopener noreferrer')
		fireEvent.click(chips[0])
		await waitFor(() =>
			expect(router.state.location.pathname).toBe('/supabase')
		)
		expect(router.state.location.search).toEqual({ ref: 'docs' })
		expect(router.state.location.hash).toBe('setup')
	})

	it('previews a mentioned project on focus and follows its details link', async () => {
		const prepared = emptyPublicContent()
		prepared.projectsBySlug.vite = {
			slug: 'vite',
			name: 'Vite',
			logo: 'projects/vite/logo.svg',
			tagline: 'Next generation frontend tooling. Fast dev, instant HMR.',
			stars: 83_335,
			forks: 8_847,
		}
		const router = await documentRouter('Built with [Vite](/vite)', prepared)
		render(<RouterProvider router={router} />)
		const trigger = screen.getByRole('link', { name: 'Vite' })
		expect(screen.queryByText('View project details')).toBeNull()
		fireEvent.focus(trigger)
		const details = await screen.findByText('View project details')
		const preview = details.closest<HTMLElement>(
			'[data-slot="hover-card-content"]'
		)!
		expect(preview.textContent).toContain(prepared.projectsBySlug.vite.tagline)
		expect(preview.textContent).toContain('83,335')
		expect(preview.textContent).toContain('8,847')
		expect(details.getAttribute('href')).toBe('/vite')
		expect(document.querySelector('a a')).toBeNull()
		const watermark = preview.querySelector('img[aria-hidden="true"]')!
		fireEvent.error(watermark)
		expect(preview.querySelector('img[aria-hidden="true"]')).toBeNull()
		fireEvent.click(details)
		await waitFor(() => expect(router.state.location.pathname).toBe('/vite'))
	})

	it('keeps zero statistics visible when a mentioned project has no logo or tagline', async () => {
		const prepared = emptyPublicContent()
		prepared.projectsBySlug.atlas = {
			slug: 'atlas',
			name: 'Atlas',
			logo: null,
			tagline: null,
			stars: 0,
			forks: 0,
		}
		const router = await documentRouter('[Atlas](/atlas)', prepared)
		render(<RouterProvider router={router} />)
		fireEvent.focus(screen.getByRole('link', { name: 'Atlas' }))
		const details = await screen.findByText('View project details')
		const preview = details.closest<HTMLElement>(
			'[data-slot="hover-card-content"]'
		)!
		expect(within(preview).getAllByText('0')).toHaveLength(2)
		expect(preview.querySelector('img')).toBeNull()
		expect(preview.textContent).not.toContain('NaN')
	})

	it('copies source whitespace exactly and announces clipboard failure', async () => {
		const code = '\tline  \n\n'
		const writeText = vi.fn().mockResolvedValue(undefined)
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText },
		})
		const router = await documentRouter(`\`\`\`unknown\n${code}\n\`\`\``)
		render(<RouterProvider router={router} />)
		expect(screen.getByLabelText('unknown code').textContent).toBe(code)
		fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))
		await screen.findByText('Copied')
		expect(writeText).toHaveBeenCalledExactlyOnceWith(code)
		writeText.mockRejectedValueOnce(new Error('denied'))
		fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))
		await screen.findByText('Unable to copy code. Select and copy it manually.')
		expect(screen.getByRole('button', { name: 'Copy code' }).textContent).toBe(
			'Copy failed'
		)
	})

	it('includes highlighting and mentions in SSR and hydrates identical markup', async () => {
		const prepared: PreparedPublicContent = {
			projectsBySlug: {
				supabase: {
					slug: 'supabase',
					name: 'Supabase',
					logo: null,
					tagline: null,
					stars: 0,
					forks: 0,
				},
			},
			codeBlocks: {
				0: {
					code: 'const x = 1',
					language: 'js',
					tokens: [
						[
							{
								content: 'const x = 1',
								light: { color: '#123456' },
								dark: { color: '#abcdef' },
							},
						],
					],
				},
			},
		}
		const router = await documentRouter(
			'```js\nconst x = 1\n```\n\n[db](/supabase)',
			prepared
		)
		const html = renderToString(<RouterProvider router={router} />)
		expect(html).toContain('--code-light-color:#123456')
		expect(html).toContain('--code-dark-color:#abcdef')
		expect(html).toContain('data-project-mention="supabase"')
		const container = document.createElement('div')
		container.innerHTML = html
		const parsedHtml = container.innerHTML
		document.body.append(container)
		const recoverable = vi.fn()
		let hydrated: ReturnType<typeof hydrateRoot> | undefined
		await act(async () => {
			hydrated = hydrateRoot(container, <RouterProvider router={router} />, {
				onRecoverableError: recoverable,
			})
			await Promise.resolve()
		})
		expect(recoverable).not.toHaveBeenCalled()
		expect(container.innerHTML).toBe(parsedHtml)
		act(() => hydrated?.unmount())
		container.remove()
	})
})
