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
import type * as MainRouteModule from '#/routes/_main/route'
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
			VITE_APP_NAME: 'Altstack',
			VITE_APP_URL: 'http://localhost:3010',
			VITE_SERVER_URL: 'http://localhost:3001',
			VITE_S3_PUBLIC_URL: 'https://storage.test',
		},
	}
})

vi.mock('#/routes/_app/index', async () => {
	const { createFileRoute } = await import('@tanstack/react-router')
	return { Route: createFileRoute('/_app/')({ component: () => null }) }
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

const actorId = '550e8400-e29b-41d4-a716-446655440000'
const targetId = '550e8400-e29b-41d4-a716-446655440001'
const projectId = '550e8400-e29b-41d4-a716-446655440002'
const pagination = {
	page: 1,
	limit: 25,
	totalItems: 1,
	totalPages: 1,
	hasNextPage: false,
	hasPreviousPage: false,
}
const person = {
	id: targetId,
	name: 'Approved Person',
	email: 'private@example.test',
	emailVerified: true,
	role: 'user',
	banned: false,
	banReason: null,
	banExpires: null,
	createdAt: new Date('2026-10-01'),
	revision: '7',
}
const member = {
	userId: targetId,
	name: person.name,
	role: 'owner',
	createdAt: person.createdAt,
	revision: '11',
	active: true,
}
let canManage = true
let members = [member]
let account = { ...person }
let failAction = false
const routers: Array<ReturnType<typeof getRouter>> = []
function respondToRPC(path: Array<string>, input: unknown) {
	const key = path.join('.')
	if (key === 'admin.user.list') return { users: [account], pagination }
	if (key === 'admin.user.get') {
		return {
			user: account,
			providers: ['github'],
			activeSessions: 2,
			memberships: [
				{
					projectId,
					projectName: 'Member project',
					status: 'published',
					role: 'owner',
				},
			],
		}
	}
	if (key === 'admin.user.action') {
		if (failAction) {
			throw new Error(
				'This account changed. Refresh the user before trying again.'
			)
		}
		const body = (input as { body: { action: string; role?: string } }).body
		account = {
			...account,
			revision: '8',
			banned:
				body.action === 'ban'
					? true
					: body.action === 'unban'
						? false
						: account.banned,
			role: body.role ?? account.role,
		}
		return { success: true }
	}
	if (key === 'ownership.members') {
		return {
			project: {
				id: projectId,
				name: 'Member project',
				status: 'published',
			},
			canManage,
			members,
			self: canManage ? null : (members[0] ?? null),
			pagination,
		}
	}
	if (key === 'ownership.changeMemberRole') {
		members = [{ ...member, role: 'maintainer', revision: '12' }]
		return { success: true }
	}
	if (key === 'ownership.revokeMember' || key === 'ownership.leave') {
		if (failAction) {
			throw new Error(
				'This membership changed. Refresh members before trying again.'
			)
		}
		members = []
		return { success: true }
	}
	if (key === 'ownership.list') {
		return { projects: [], pagination: { ...pagination, totalItems: 0 } }
	}
	if (key === 'ownership.inbox') {
		return { claims: [], pagination: { ...pagination, totalItems: 0 } }
	}
	throw new Error(`Unexpected procedure ${key}`)
}

beforeEach(() => {
	vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
	getAuthFn
		.mockReset()
		.mockResolvedValue({ user: { id: actorId, role: 'admin' }, session: {} })
	canManage = true
	members = [{ ...member }]
	account = { ...person }
	failAction = false
	rpc
		.mockReset()
		.mockImplementation((path, input) =>
			Promise.resolve().then(() => respondToRPC(path, input))
		)
})
afterEach(() => {
	cleanup()
	for (const router of routers.splice(0)) {
		router.options.context.queryClient.clear()
	}
	vi.restoreAllMocks()
})
async function routerAt(path: string) {
	const router = getRouter()
	routers.push(router)
	router.update({
		context: router.options.context,
		history: createMemoryHistory({ initialEntries: [path] }),
	})
	await act(async () => {
		await router.load()
		render(<RouterProvider router={router} />)
	})
	return router
}
describe('admin users and project membership journeys', () => {
	it.each(['/admin/users', `/admin/users/${targetId}`])(
		'guards %s before reading private users',
		async (path) => {
			getAuthFn.mockResolvedValue({
				user: { id: actorId, role: 'user' },
				session: {},
			})
			const router = await routerAt(path)
			await waitFor(() => expect(router.state.location.pathname).toBe('/'))
			expect(
				rpc.mock.calls.filter(([p]) => p.slice(0, 2).join('.') === 'admin.user')
			).toEqual([])
			expect(screen.queryByText(person.email)).toBeNull()
		}
	)
	it('lists users, submits URL filters and opens the protected detail destination', async () => {
		const router = await routerAt('/admin/users')
		await screen.findByRole('table', { name: 'Users' })
		expect(
			screen.getByRole('link', { name: 'View user' }).getAttribute('href')
		).toBe(`/admin/users/${targetId}`)
		fireEvent.change(screen.getByLabelText('Search name or email'), {
			target: { value: 'private' },
		})
		fireEvent.change(screen.getByLabelText('Account status'), {
			target: { value: 'banned' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Search users' }))
		await waitFor(() =>
			expect(router.state.location.search).toMatchObject({
				q: 'private',
				status: 'banned',
				page: 1,
			})
		)
		expect(rpc).toHaveBeenCalledWith(
			['admin', 'user', 'list'],
			expect.objectContaining({
				query: { q: 'private', role: 'all', status: 'banned', page: 1 },
			}),
			expect.anything()
		)
	})
	it('requires confirmation and a reason before banning, then refreshes the user and exposes unban', async () => {
		await routerAt(`/admin/users/${targetId}`)
		await screen.findByRole('heading', { name: person.name })
		expect(
			screen.getByRole('link', { name: 'Manage members' }).getAttribute('href')
		).toBe(`/managed/${projectId}/members`)
		fireEvent.click(screen.getByRole('button', { name: 'Ban account' }))
		await screen.findByRole('alertdialog', { name: `Ban ${person.name}?` })
		expect(
			screen.getByRole('button', { name: 'Confirm' }).hasAttribute('disabled')
		).toBe(true)
		fireEvent.change(screen.getByLabelText('Reason for ban'), {
			target: { value: 'Repeated abuse' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
		await screen.findByRole('button', { name: 'Unban account' })
		expect(rpc).toHaveBeenCalledWith(
			['admin', 'user', 'action'],
			{
				params: { id: targetId },
				body: { action: 'ban', reason: 'Repeated abuse', revision: '7' },
			},
			expect.anything()
		)
	})
	it('keeps stale-account errors visible, cancels safely and lets the admin refresh', async () => {
		failAction = true
		await routerAt(`/admin/users/${targetId}`)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Grant admin role' })
		)
		fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
		await screen.findByText(
			'This account changed. Refresh the user before trying again.'
		)
		expect(screen.getByRole('alertdialog')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
		fireEvent.click(screen.getByRole('button', { name: 'Refresh user' }))
	})
	it('lets admins change labels and revoke members after confirmation, refetching persisted data', async () => {
		await routerAt(`/managed/${projectId}/members`)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Change to maintainer' })
		)
		fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
		await screen.findByRole('button', { name: 'Change to owner' })
		expect(rpc).toHaveBeenCalledWith(
			['ownership', 'changeMemberRole'],
			{
				params: { id: projectId, userId: targetId },
				body: { revision: '11', role: 'maintainer' },
			},
			expect.anything()
		)
		fireEvent.click(
			screen.getByRole('button', { name: `Revoke ${person.name}` })
		)
		fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
		await screen.findByText(/No approved members/)
		expect(rpc).toHaveBeenCalledWith(
			['ownership', 'revokeMember'],
			{ params: { id: projectId, userId: targetId }, body: { revision: '12' } },
			expect.anything()
		)
	})
	it('shows self-service leave without admin actions and returns to My projects after confirmation', async () => {
		canManage = false
		getAuthFn.mockResolvedValue({
			user: { id: targetId, role: 'user' },
			session: {},
		})
		const router = await routerAt(`/managed/${projectId}/members`)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Leave project' })
		)
		expect(
			screen.queryByRole('button', { name: 'Change to maintainer' })
		).toBeNull()
		expect(screen.queryByRole('link', { name: 'View user' })).toBeNull()
		await screen.findByText(/If no active representatives remain/)
		fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
		await waitFor(() => expect(router.state.location.pathname).toBe('/managed'))
		expect(rpc).toHaveBeenCalledWith(
			['ownership', 'leave'],
			{ params: { id: projectId }, body: { revision: '11' } },
			expect.anything()
		)
	})
	it('keeps failed revocation visible without removing the member', async () => {
		failAction = true
		await routerAt(`/managed/${projectId}/members`)
		fireEvent.click(
			await screen.findByRole('button', { name: `Revoke ${person.name}` })
		)
		fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
		await screen.findByText(
			'This membership changed. Refresh members before trying again.'
		)
		expect(members).toHaveLength(1)
	})
})
