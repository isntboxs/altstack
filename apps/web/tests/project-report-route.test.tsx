// @vitest-environment jsdom
import { createORPCClient } from '@orpc/client'
import type { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import type * as StartModule from '@tanstack/react-start'
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterClient } from '@altstack/api/routers'

import { getRouter } from '#/router'
import type * as AppRouteModule from '#/routes/_app/route'
import type { orpc } from '#/utils/orpc'

const { getAuthFn, rpc } = vi.hoisted(() => {
	return {
		getAuthFn: vi.fn<
			() => Promise<{
				user: { id: string; role: 'user' | 'admin' }
				session: Record<string, never>
			} | null>
		>(),
		rpc: vi.fn<(path: Array<string>, input: unknown) => Promise<unknown>>(),
	}
})
vi.mock('#/routes/__root', async () => {
	const { createRootRouteWithContext, Outlet } =
		await import('@tanstack/react-router')
	return {
		Route: createRootRouteWithContext<{
			queryClient: QueryClient
			orpc: typeof orpc
		}>()({
			beforeLoad: async () => {
				return { auth: await getAuthFn() }
			},
			component: Outlet,
		}),
	}
})
vi.mock('#/routes/_app/route', async () => {
	const actual = await vi.importActual<typeof AppRouteModule>(
		'#/routes/_app/route'
	)
	const { Outlet } = await import('@tanstack/react-router')
	actual.Route.update({ component: Outlet })
	return actual
})
vi.mock('#/functions/get-auth-fn', () => {
	return { getAuthFn }
})
vi.mock('#/hooks/use-auth-identity', () => {
	return { useAuthIdentity: vi.fn() }
})
vi.mock('#/components/auth-dialog', () => {
	return { AuthDialog: () => null }
})
vi.mock('#/components/theme-switcher', () => {
	return { ThemeSwitcher: () => null }
})
vi.mock('#/components/block-note/view.tsx', () => {
	return {
		BlockNoteViewBlocks: () => null,
	}
})
vi.mock('@altstack/api/routers', () => {
	return { routers: {} }
})
vi.mock('@altstack/api/context', () => {
	return { createORPCContext: vi.fn() }
})
vi.mock('@tanstack/react-start/server', () => {
	return { getRequestHeaders: vi.fn() }
})
vi.mock('@altstack/env/web', () => {
	return {
		env: {
			VITE_APP_URL: 'http://localhost:3010',
			VITE_APP_NAME: 'Altstack',
			VITE_SERVER_URL: 'http://localhost:3001',
			VITE_S3_PUBLIC_URL: 'https://storage.test',
		},
	}
})
vi.mock('@tanstack/react-start', async () => {
	const actual = await vi.importActual<typeof StartModule>(
		'@tanstack/react-start'
	)
	const client = createORPCClient<ORPCRouterClient>({ call: rpc })
	return {
		...actual,
		createIsomorphicFn: () => {
			return {
				server: () => {
					return { client: () => () => client }
				},
			}
		},
	}
})

vi.mock('#/features/project/components/github-statistics', () => {
	return {
		GithubStatistics: () => null,
	}
})
vi.mock('@altstack/ui/components/toast', () => {
	return { toast: { add: vi.fn() } }
})
const project = {
	id: '550e8400-e29b-41d4-a716-446655440000',
	name: 'Example',
	verified: false,
	slug: 'example',
	tagline: 'Test project',
	description: 'Published description',
	logo: null,
	screenshot: null,
	websiteUrl: null,
	content: null,
	repositoryUrl: 'https://github.com/test/example',
	status: 'published',
	createdAt: new Date(),
	updatedAt: new Date(),
	categoryDetails: [],
	github: {
		licenseKey: null,
		licenseName: null,
		licenseSpdxId: null,
		licenseSlug: null,
		licenseUrl: null,
		archived: null,
		owner: 'test',
		repo: 'example',
		stars: 5,
		forks: 1,
		fetchedAt: new Date(),
	},
	githubStarsHistory: { points: [], comparison: null },
	featuredProjects: [],
	tags: [],
}
const routers: Array<ReturnType<typeof getRouter>> = []
beforeEach(() => {
	vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
	vi.stubGlobal(
		'matchMedia',
		vi.fn(() => {
			return {
				matches: false,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
			}
		})
	)
	getAuthFn.mockReset().mockResolvedValue(null)
	rpc.mockReset().mockImplementation((path) => {
		if (path.join('/') === 'project/getBySlug') return Promise.resolve(project)
		if (path.join('/') === 'ownership/state') {
			return Promise.resolve({ membership: null, claim: null })
		}
		if (path.join('/') === 'bookmark/get') {
			return Promise.resolve({ bookmarked: false })
		}
		throw new Error('Unexpected RPC ' + path.join('/'))
	})
})
afterEach(() => {
	cleanup()
	routers
		.splice(0)
		.forEach((router) => router.options.context.queryClient.clear())
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})
async function routerAt(url: string) {
	const router = getRouter()
	routers.push(router)
	router.update({
		context: router.options.context,
		history: createMemoryHistory({ initialEntries: [url] }),
	})
	await act(async () => {
		await router.load()
		render(<RouterProvider router={router} />)
	})
	return router
}
const projectReads = () =>
	rpc.mock.calls.filter(([path]) => path.join('/') === 'project/getBySlug')
		.length

describe('project report URL lifecycle', () => {
	it('opens direct URLs/reloads for guests, preserves unrelated search/hash, closes via Cancel/Close/Escape, supports history without refetch', async () => {
		const router = await routerAt('/example?dialog=report&ref=docs#details')
		await screen.findByRole('dialog', { name: 'Report Example' })
		expect(screen.getByRole('textbox', { name: 'Email' })).toBeTruthy()
		const reads = projectReads()
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		expect(router.state.location.search).toEqual({
			ref: 'docs',
			dialog: undefined,
		})
		expect(router.state.location.hash).toBe('details')
		act(() => {
			router.history.back()
		})
		await screen.findByRole('dialog', { name: 'Report Example' })
		act(() => {
			router.history.forward()
		})
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		fireEvent.click(screen.getByRole('button', { name: 'Report' }))
		await screen.findByRole('dialog', { name: 'Report Example' })
		fireEvent.click(screen.getByRole('button', { name: 'Close' }))
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		fireEvent.click(screen.getByRole('button', { name: 'Report' }))
		const dialog = await screen.findByRole('dialog', { name: 'Report Example' })
		await waitFor(() =>
			expect(dialog.contains(document.activeElement)).toBe(true)
		)
		fireEvent.keyDown(document.activeElement!, {
			key: 'Escape',
			code: 'Escape',
		})
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		expect(projectReads()).toBe(reads)
		expect(
			screen.getByRole('heading', { name: 'Example', level: 1 })
		).toBeTruthy()
		expect(router.state.location.search.ref).toBe('docs')
		cleanup()
		await routerAt('/example?dialog=report&ref=reload')
		await screen.findByRole('dialog', { name: 'Report Example' })
	})
	it.each(['user', 'admin'] as const)(
		'opens from compact actions for %s and keeps Embed mutually exclusive',
		async (role) => {
			getAuthFn.mockResolvedValue({
				user: { id: 'account-a', role },
				session: {},
			})
			const router = await routerAt('/example?ref=docs')
			const reads = projectReads()
			fireEvent.click(
				screen.getByRole('button', { name: 'More project actions' })
			)
			fireEvent.click(await screen.findByRole('menuitem', { name: 'Report' }))
			await screen.findByRole('dialog', { name: 'Report Example' })
			expect(screen.queryByRole('textbox', { name: 'Email' })).toBeNull()
			expect(router.state.location.search.dialog).toBe('report')
			await act(async () => {
				await router.navigate({
					to: '/$slug',
					params: { slug: 'example' },
					search: (previous) => {
						return { ...previous, dialog: 'embed' }
					},
					resetScroll: false,
				})
			})
			await screen.findByRole('dialog', { name: 'Embed the Example badge' })
			expect(
				screen.queryByRole('dialog', { name: 'Report Example' })
			).toBeNull()
			expect(projectReads()).toBe(reads)
		}
	)
})

describe('project Verify URL and claim flow', () => {
	it('opens direct/reloaded URLs, preserves other search/hash, restores history and does not reload detail data', async () => {
		getAuthFn.mockResolvedValue({
			user: { id: 'account-a', role: 'user' },
			session: {},
		})
		const router = await routerAt('/example?dialog=verify&ref=docs#details')
		await screen.findByRole('dialog', { name: 'Verify Example' })
		await screen.findByRole('textbox', { name: 'Email address' })
		const reads = projectReads()
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		expect(router.state.location.search.ref).toBe('docs')
		expect(router.state.location.hash).toBe('details')
		act(() => router.history.back())
		await screen.findByRole('dialog', { name: 'Verify Example' })
		act(() => router.history.forward())
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
		const dialog = await screen.findByRole('dialog', { name: 'Verify Example' })
		await waitFor(() =>
			expect(dialog.contains(document.activeElement)).toBe(true)
		)
		fireEvent.keyDown(document.activeElement!, {
			key: 'Escape',
			code: 'Escape',
		})
		await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
		expect(projectReads()).toBe(reads)
		cleanup()
		await routerAt('/example?dialog=verify&ref=reload')
		await screen.findByRole('textbox', { name: 'Email address' })
	})
	it('hands anonymous visitors to sign-in within the same URL-controlled dialog', async () => {
		const router = await routerAt('/example?dialog=verify&ref=auth')
		await screen.findByRole('dialog', { name: 'Verify Example' })
		expect(
			screen.getByText('Sign in to attach this request to your account.')
		).toBeTruthy()
		expect(
			screen.getByRole('button', { name: 'Continue with GitHub' })
		).toBeTruthy()
		expect(router.state.location.search.dialog).toBe('verify')
		expect(rpc.mock.calls.some(([path]) => path[0] === 'ownership')).toBe(false)
	})
	it('sends the selected email and role, confirms a six-digit code, and shows pending approval without a badge', async () => {
		getAuthFn.mockResolvedValue({
			user: { id: 'account-a', role: 'user' },
			session: {},
		})
		const challengeId = '550e8400-e29b-41d4-a716-446655440001'
		let confirmed = false
		const original = rpc.getMockImplementation()!
		rpc.mockImplementation((path, input) => {
			if (path.join('/') === 'ownership/state') {
				return Promise.resolve({
					membership: null,
					claim: confirmed
						? {
								status: 'pending',
								role: 'maintainer',
								email: 'contact@example.test',
								challenge: null,
							}
						: null,
				})
			}
			if (path.join('/') === 'ownership/request') {
				return Promise.resolve({
					challengeId,
					expiresAt: new Date(Date.now() + 600000),
					resendAt: new Date(Date.now() + 60000),
				})
			}
			if (path.join('/') === 'ownership/verify') {
				confirmed = true
				return Promise.resolve({ success: true })
			}
			return original(path, input)
		})
		await routerAt('/example?dialog=verify')
		fireEvent.change(
			await screen.findByRole('textbox', { name: 'Email address' }),
			{ target: { value: 'contact@example.test' } }
		)
		fireEvent.click(screen.getByRole('combobox', { name: 'Your role' }))
		fireEvent.pointerDown(
			await screen.findByRole('option', { name: 'Maintainer' }),
			{ pointerType: 'mouse' }
		)
		fireEvent.mouseUp(screen.getByRole('option', { name: 'Maintainer' }))
		fireEvent.click(screen.getByRole('option', { name: 'Maintainer' }))
		await waitFor(() =>
			expect(
				screen.getByRole('combobox', { name: 'Your role' }).textContent
			).toContain('Maintainer')
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Send verification code' })
		)
		const code = await screen.findByRole('textbox', {
			name: 'Verification code',
		})
		expect(
			rpc.mock.calls.find(
				([path]) => path.join('/') === 'ownership/request'
			)?.[1]
		).toEqual({
			params: { id: project.id },
			body: { email: 'contact@example.test', role: 'maintainer' },
		})
		expect(screen.getByRole('button', { name: /Resend in/ })).toHaveProperty(
			'disabled',
			true
		)
		fireEvent.change(code, { target: { value: '123456' } })
		fireEvent.click(screen.getByRole('button', { name: 'Confirm code' }))
		await screen.findByText(
			/Email confirmed\. Your maintainer request is awaiting/
		)
		expect(screen.queryByText('Verified project')).toBeNull()
	})
	it('hides Verify on verified listings and keeps Request access available from compact actions', async () => {
		const original = rpc.getMockImplementation()!
		rpc.mockImplementation((path, input) =>
			path.join('/') === 'project/getBySlug'
				? Promise.resolve({ ...project, verified: true })
				: original(path, input)
		)
		await routerAt('/example')
		await screen.findByText('Verified project')
		expect(screen.queryByRole('button', { name: 'Verify' })).toBeNull()
		fireEvent.click(
			screen.getByRole('button', { name: 'More project actions' })
		)
		expect(screen.queryByRole('menuitem', { name: 'Verify' })).toBeNull()
		fireEvent.click(
			await screen.findByRole('menuitem', { name: 'Request access' })
		)
		await screen.findByRole('dialog', { name: 'Verify Example' })
	})
	it('restores a sent challenge after reload, handles expiry/resend, and retains a code after verification errors', async () => {
		getAuthFn.mockResolvedValue({
			user: { id: 'account-a', role: 'user' },
			session: {},
		})
		const original = rpc.getMockImplementation()!
		const challengeId = '550e8400-e29b-41d4-a716-446655440001'
		rpc.mockImplementation((path, input) => {
			if (path.join('/') === 'ownership/state') {
				return Promise.resolve({
					membership: null,
					claim: {
						status: 'email_pending',
						role: 'maintainer',
						email: 'contact@example.test',
						challenge: {
							challengeId,
							expiresAt: new Date(Date.now() - 1000),
							resendAt: new Date(Date.now() - 1000),
						},
					},
				})
			}
			if (path.join('/') === 'ownership/request') {
				return Promise.resolve({
					challengeId: '550e8400-e29b-41d4-a716-446655440002',
					expiresAt: new Date(Date.now() + 600000),
					resendAt: new Date(Date.now() + 60000),
				})
			}
			if (path.join('/') === 'ownership/verify') {
				return Promise.reject(
					new Error(
						'The code is invalid or expired. Request a new code and try again.'
					)
				)
			}
			return original(path, input)
		})
		await routerAt('/example?dialog=verify')
		await screen.findByRole('textbox', { name: 'Verification code' })
		expect(screen.getByText(/This code has expired/)).toBeTruthy()
		expect(screen.getByRole('button', { name: 'Confirm code' })).toHaveProperty(
			'disabled',
			true
		)
		fireEvent.click(screen.getByRole('button', { name: 'Resend code' }))
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Confirm code' })
			).toHaveProperty('disabled', false)
		)
		fireEvent.change(
			screen.getByRole('textbox', { name: 'Verification code' }),
			{ target: { value: '123456' } }
		)
		fireEvent.click(screen.getByRole('button', { name: 'Confirm code' }))
		await screen.findByRole('alert')
		expect(
			screen.getByRole('textbox', { name: 'Verification code' })
		).toHaveProperty('value', '123456')
	})
})
