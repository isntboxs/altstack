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

import type { ORPCRouterClient, ORPCRouterInputs } from '@altstack/api/routers'

import type * as AuthClientModule from '@altstack/auth/client'

import { getRouter } from '#/router'
import type * as AppRouteModule from '#/routes/_app/route'
import type * as MainRouteModule from '#/routes/_main/route'
import type { orpc } from '#/utils/orpc'

const { getAuthFn, rpc, linkSocial } = vi.hoisted(() => {
	return {
		linkSocial:
			vi.fn<
				(input: {
					provider: string
					callbackURL: string
					errorCallbackURL: string
				}) => Promise<{ error: null }>
			>(),
		getAuthFn: vi.fn<
			() => Promise<{
				user: { id: string; role: 'user' | 'admin' }
				session: Record<string, never>
			} | null>
		>(),
		rpc: vi.fn<(path: Array<string>, input: unknown) => Promise<unknown>>(),
	}
})
vi.mock('@altstack/auth/client', async (importOriginal) => {
	const actual = await importOriginal<typeof AuthClientModule>()
	return {
		...actual,
		authClient: {
			...actual.authClient,
			signIn: actual.authClient.signIn,
			linkSocial,
		},
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
vi.mock('#/routes/_main/route', async () => {
	const actual = await vi.importActual<typeof MainRouteModule>(
		'#/routes/_main/route'
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
vi.mock('#/components/block-note/editor', () => {
	return { default: () => null }
})
vi.mock('#/components/category-combobox-view', () => {
	return { CategoryComboboxView: () => null }
})
vi.mock('#/components/image-uploader', () => {
	return {
		LogoUploader: ({ onChange }: { onChange: (key: string) => void }) => (
			<button
				type="button"
				onClick={() => onChange('tmp/logos/first-project.png')}
			>
				Upload test logo
			</button>
		),
		ScreenshotUploader: () => null,
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
	linkSocial.mockReset().mockResolvedValue({ error: null })
	rpc.mockReset().mockImplementation((path) => {
		if (path.join('/') === 'project/getBySlug') return Promise.resolve(project)
		if (path.join('/') === 'ownership/github') {
			return Promise.resolve({
				status: 'verified',
				permission: 'maintain',
				reason: null,
				githubUserId: '123',
				login: 'representative',
				repositoryId: '456',
				checkedAt: new Date().toISOString(),
			})
		}
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

describe('managed project editor navigation', () => {
	it('resets drafts and uploads across projects with equal revisions and after a revision reload', async () => {
		getAuthFn.mockResolvedValue({
			user: { id: 'account-a', role: 'user' },
			session: {},
		})
		const first = {
			...project,
			logo: 'projects/example/logo.png',
			revision: '42',
			categorySlugs: ['tools'],
		}
		let second = {
			...first,
			id: '550e8400-e29b-41d4-a716-446655440001',
			name: 'Second project',
			slug: 'second',
			tagline: 'Second tagline',
			description: 'Second description',
			content: 'Second content',
		}
		const original = rpc.getMockImplementation()!
		rpc.mockImplementation((path, input) => {
			if (path.join('/') === 'ownership/get') {
				const { params } = input as ORPCRouterInputs['ownership']['get']
				return Promise.resolve(params.id === first.id ? first : second)
			}
			if (path.join('/') === 'ownership/categories') {
				return Promise.resolve({ categories: [] })
			}
			if (path.join('/') === 'ownership/update') {
				return Promise.resolve({ success: true })
			}
			return original(path, input)
		})
		const router = await routerAt(`/managed/${first.id}`)
		const firstName = await screen.findByRole('textbox', {
			name: 'Project name',
		})
		fireEvent.change(firstName, { target: { value: 'Unsaved first draft' } })
		fireEvent.click(screen.getByRole('button', { name: 'Upload test logo' }))
		await act(async () => {
			await router.navigate({ to: '/managed/$id', params: { id: second.id } })
		})
		await screen.findByRole('heading', { name: 'Edit Second project' })
		expect(
			screen.getByRole('textbox', { name: 'Project name' })
		).toHaveProperty('value', 'Second project')
		fireEvent.click(screen.getByRole('button', { name: 'Publish changes' }))
		await waitFor(() =>
			expect(
				rpc.mock.calls.find(
					([path]) => path.join('/') === 'ownership/update'
				)?.[1]
			).toEqual({
				params: { id: second.id },
				body: {
					revision: '42',
					name: 'Second project',
					tagline: 'Second tagline',
					description: 'Second description',
					websiteUrl: null,
					content: 'Second content',
					categorySlugs: ['tools'],
				},
			})
		)
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Publish changes' })
			).toHaveProperty('disabled', false)
		)
		fireEvent.change(screen.getByRole('textbox', { name: 'Project name' }), {
			target: { value: 'Unsaved second draft' },
		})
		second = { ...second, revision: '43', name: 'Reloaded project' }
		fireEvent.click(screen.getByRole('button', { name: 'Reload project' }))
		await waitFor(() =>
			expect(
				screen.getByRole('textbox', { name: 'Project name' })
			).toHaveProperty('value', 'Reloaded project')
		)
	})
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
	it('requires GitHub connection and preserves the exact Verify return URL when linking', async () => {
		getAuthFn.mockResolvedValue({
			user: { id: 'account-a', role: 'user' },
			session: {},
		})
		const original = rpc.getMockImplementation()!
		rpc.mockImplementation((path, input) =>
			path.join('/') === 'ownership/github'
				? Promise.resolve({
						status: 'disconnected',
						permission: 'unknown',
						reason: 'account_required',
						githubUserId: null,
						login: null,
						repositoryId: null,
						checkedAt: new Date().toISOString(),
					})
				: original(path, input)
		)
		await routerAt('/example?dialog=verify&ref=claim#screenshots')
		await screen.findByText(/Connect your GitHub account before requesting/)
		expect(
			screen.getByRole('button', { name: 'Send verification code' })
		).toHaveProperty('disabled', true)
		fireEvent.click(screen.getByRole('button', { name: 'Connect GitHub' }))
		await waitFor(() => expect(linkSocial).toHaveBeenCalledOnce())
		const callbackURL = new URL(
			'/example?dialog=verify&ref=claim#screenshots',
			window.location.origin
		).href
		expect(linkSocial).toHaveBeenCalledWith({
			provider: 'github',
			callbackURL,
			errorCallbackURL: callbackURL,
		})
		expect(
			rpc.mock.calls.some(([path]) => path.join('/') === 'ownership/request')
		).toBe(false)
	})
	it('blocks read-only claims and lets a successful recheck enable the email flow', async () => {
		getAuthFn.mockResolvedValue({
			user: { id: 'account-a', role: 'user' },
			session: {},
		})
		const original = rpc.getMockImplementation()!
		let allowed = false
		rpc.mockImplementation((path, input) =>
			path.join('/') === 'ownership/github'
				? Promise.resolve({
						status: allowed ? 'verified' : 'denied',
						permission: allowed ? 'maintain' : 'read',
						reason: allowed ? null : 'insufficient_access',
						githubUserId: '123',
						login: 'reader',
						repositoryId: '456',
						checkedAt: new Date().toISOString(),
					})
				: original(path, input)
		)
		await routerAt('/example?dialog=verify')
		await screen.findByText(/does not have write or maintainer access/)
		expect(
			screen.getByRole('button', { name: 'Send verification code' })
		).toHaveProperty('disabled', true)
		allowed = true
		fireEvent.click(screen.getByRole('button', { name: 'Check GitHub again' }))
		await screen.findByText(/reader has maintain access/)
		expect(
			screen.getByRole('button', { name: 'Send verification code' })
		).toHaveProperty('disabled', false)
	})
	it('labels unavailable GitHub proof for manual review without presenting it as verified', async () => {
		getAuthFn.mockResolvedValue({
			user: { id: 'account-a', role: 'user' },
			session: {},
		})
		const original = rpc.getMockImplementation()!
		rpc.mockImplementation((path, input) =>
			path.join('/') === 'ownership/github'
				? Promise.resolve({
						status: 'unavailable',
						permission: 'unknown',
						reason: 'github_unavailable',
						githubUserId: '123',
						login: null,
						repositoryId: null,
						checkedAt: new Date().toISOString(),
					})
				: original(path, input)
		)
		await routerAt('/example?dialog=verify')
		await screen.findByText(/GitHub could not confirm repository access/)
		expect(
			screen.getByRole('button', { name: 'Send verification code' })
		).toHaveProperty('disabled', false)
		expect(screen.queryByText('Verified project')).toBeNull()
	})
	it.each([
		{ evidenceStatus: 'limited', permission: 'write' },
		{ evidenceStatus: 'verified', permission: 'maintain' },
	] as const)(
		'validates notes and confirms approvals for $evidenceStatus GitHub proof',
		async ({ evidenceStatus, permission }) => {
			getAuthFn.mockResolvedValue({
				user: { id: 'reviewer-a', role: 'admin' },
				session: {},
			})
			const original = rpc.getMockImplementation()!
			const pagination = {
				page: 1,
				limit: 25,
				totalItems: 1,
				totalPages: 1,
				hasNextPage: false,
				hasPreviousPage: false,
			}
			let reviewed = false
			rpc.mockImplementation((path, input) => {
				if (path.join('/') === 'ownership/list') {
					return Promise.resolve({ projects: [], pagination })
				}
				if (path.join('/') === 'ownership/inbox') {
					return Promise.resolve({
						claims: reviewed
							? []
							: [
									{
										id: project.id,
										projectId: project.id,
										projectName: 'Example',
										projectSlug: 'example',
										name: 'Representative',
										email: 'contact@example.test',
										role: 'maintainer',
										requestedAt: new Date(),
										githubEvidence: {
											status: evidenceStatus,
											permission,
											reason: null,
											githubUserId: '123',
											login: 'representative',
											repositoryId: '456',
											checkedAt: new Date().toISOString(),
										},
									},
								],
						pagination,
					})
				}
				if (path.join('/') === 'ownership/review') {
					reviewed = true
					return Promise.resolve({ success: true })
				}
				return original(path, input)
			})
			await routerAt('/admin/ownership')
			await screen.findByText(
				new RegExp(`representative has ${permission} access`)
			)
			fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
			await screen.findByRole('dialog', { name: 'Approve project access?' })
			expect(
				screen.getByRole('button', { name: 'Confirm decision' })
			).toHaveProperty('disabled', evidenceStatus !== 'verified')
			fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
			fireEvent.change(
				screen.getByRole('textbox', {
					name: 'Independent verification notes for Example',
				}),
				{ target: { value: '  Too short  ' } }
			)
			expect(
				screen
					.getByRole('textbox', {
						name: 'Independent verification notes for Example',
					})
					.getAttribute('aria-invalid')
			).toBe('true')
			expect(screen.getByText(/Enter at least 20 characters/)).toBeTruthy()
			fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
			await screen.findByRole('dialog', { name: 'Approve project access?' })
			expect(
				screen.getByRole('button', { name: 'Confirm decision' })
			).toHaveProperty('disabled', true)
			fireEvent.click(screen.getByRole('button', { name: 'Confirm decision' }))
			expect(
				rpc.mock.calls.some(([path]) => path.join('/') === 'ownership/review')
			).toBe(false)
			fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
			const manualEvidence = 'Confirmed maintainer'
			fireEvent.change(
				screen.getByRole('textbox', {
					name: 'Independent verification notes for Example',
				}),
				{ target: { value: `  ${manualEvidence}  ` } }
			)
			fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
			await screen.findByRole('dialog', { name: 'Approve project access?' })
			expect(
				rpc.mock.calls.some(([path]) => path.join('/') === 'ownership/review')
			).toBe(false)
			fireEvent.click(screen.getByRole('button', { name: 'Confirm decision' }))
			await waitFor(() =>
				expect(
					rpc.mock.calls.find(
						([path]) => path.join('/') === 'ownership/review'
					)?.[1]
				).toEqual({
					params: { id: project.id },
					body: { decision: 'approve', manualEvidence },
				})
			)
			await screen.findByText('No requests awaiting your review')
		}
	)
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
