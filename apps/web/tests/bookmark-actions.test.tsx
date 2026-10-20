// @vitest-environment jsdom
import { createORPCClient } from '@orpc/client'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterClient } from '@altstack/api/routers'

import { TooltipProvider } from '@altstack/ui/components/tooltip'

import { Header } from '#/components/header'
import { BookmarkDataTable } from '#/features/bookmarks/components/bookmark-data-table'
import { bookmarkQueries } from '#/features/bookmarks/queries'
import { ProjectActions } from '#/features/project/components/project-actions'

const { rpc, toast } = vi.hoisted(() => {
	return {
		rpc: vi.fn<(path: Array<string>, input: unknown) => Promise<unknown>>(),
		toast: vi.fn(),
	}
})
vi.mock('#/utils/orpc', () => {
	const client = createORPCClient<ORPCRouterClient>({ call: rpc })
	return { client, orpc: createTanstackQueryUtils(client) }
})
vi.mock('@altstack/ui/components/toast', () => {
	return { toast: { add: toast } }
})
vi.mock('#/components/auth-dialog', () => {
	return {
		AuthDialog: ({ open, returnTo }: { open: boolean; returnTo: string }) =>
			open ? (
				<dialog open aria-label="Sign in" data-return-to={returnTo} />
			) : null,
	}
})
vi.mock('#/features/project/components/project-embed-dialog', () => {
	return {
		ProjectEmbedDialog: () => null,
	}
})
vi.mock('#/components/theme-switcher', () => {
	return { ThemeSwitcher: () => null }
})
vi.mock('@altstack/auth/client', () => {
	return { authClient: { signOut: vi.fn() } }
})
vi.mock('@altstack/env/web', () => {
	return {
		env: {
			VITE_APP_NAME: 'AltStack',
			VITE_S3_PUBLIC_URL: 'https://storage.test',
		},
	}
})
vi.mock('@tanstack/react-router', () => {
	return {
		useLocation: () => {
			return { href: '/example?source=test', pathname: '/example' }
		},
		useRouter: () => {
			return { invalidate: vi.fn() }
		},
		Link: ({
			to,
			params,
			children,
			activeOptions: _activeOptions,
			activeProps: _activeProps,
			viewTransition: _viewTransition,
			...props
		}: React.ComponentProps<'a'> & {
			to: string
			params?: { slug: string }
			activeOptions?: unknown
			activeProps?: unknown
			viewTransition?: boolean
		}) => (
			<a href={params ? `/${params.slug}` : to} {...props}>
				{children}
			</a>
		),
	}
})
const clients: Array<QueryClient> = []
function view(content: React.ReactNode) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	})
	clients.push(queryClient)
	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<QueryClientProvider client={queryClient}>
			<TooltipProvider>{children}</TooltipProvider>
		</QueryClientProvider>
	)
	return { ...render(content, { wrapper }), queryClient }
}
const actionProps = {
	projectId: 'project-id',
	userId: 'user-a',
	slug: 'example',
	name: 'Example',
	embedOpen: false,
	onEmbedOpenChange: vi.fn(),
}
beforeEach(() => {
	rpc.mockReset().mockResolvedValue({ bookmarked: false })
	toast.mockReset()
})
afterEach(() => {
	cleanup()
	clients.splice(0).forEach((client) => client.clear())
	vi.restoreAllMocks()
})

describe('project bookmark actions', () => {
	it('uses the existing login dialog for guests without reading or saving private state', () => {
		view(<ProjectActions {...actionProps} userId={undefined} />)
		fireEvent.click(screen.getByRole('button', { name: 'Bookmark' }))
		expect(screen.getByRole('dialog').getAttribute('data-return-to')).toBe(
			'/example?source=test'
		)
		expect(rpc).not.toHaveBeenCalled()
	})
	it('shows loading, prevents repeat saves, persists saved state and removes through the compact menu', async () => {
		let finishRead!: (value: unknown) => void
		let finishSave!: (value: unknown) => void
		rpc.mockImplementation(async (path) => {
			if (path.at(-1) === 'get') {
				return new Promise((resolve) => {
					finishRead = resolve
				})
			}
			if (path.at(-1) === 'save') {
				return new Promise((resolve) => {
					finishSave = resolve
				})
			}
			return { bookmarked: false }
		})
		view(<ProjectActions {...actionProps} />)
		expect(
			screen.getByRole('button', { name: 'Bookmark' }).hasAttribute('disabled')
		).toBe(true)
		finishRead({ bookmarked: false })
		await waitFor(() =>
			expect(
				screen
					.getByRole('button', { name: 'Bookmark' })
					.hasAttribute('disabled')
			).toBe(false)
		)
		fireEvent.click(screen.getByRole('button', { name: 'Bookmark' }))
		const saving = await screen.findByRole('button', {
			name: 'Saving bookmark…',
		})
		expect((saving as HTMLButtonElement).hasAttribute('disabled')).toBe(true)
		fireEvent.click(saving)
		expect(
			rpc.mock.calls.filter(([path]) => path.at(-1) === 'save')
		).toHaveLength(1)
		finishSave({ bookmarked: true })
		expect(
			(
				await screen.findByRole('button', { name: 'Remove bookmark' })
			).getAttribute('aria-pressed')
		).toBe('true')
		fireEvent.click(
			screen.getByRole('button', { name: 'More project actions' })
		)
		fireEvent.click(
			await screen.findByRole('menuitem', { name: /Remove bookmark/ })
		)
		await waitFor(() =>
			expect(
				screen
					.getByRole('button', { name: 'Bookmark' })
					.getAttribute('aria-pressed')
			).toBe('false')
		)
		expect(
			rpc.mock.calls.find(([path]) => path.at(-1) === 'remove')?.[1]
		).toEqual({ params: { id: actionProps.projectId } })
	})
	it('preserves state after failed writes and supports retry after failed state reads', async () => {
		rpc
			.mockRejectedValueOnce(new Error('Offline'))
			.mockResolvedValue({ bookmarked: false })
		view(<ProjectActions {...actionProps} />)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Retry bookmark' })
		)
		const save = await screen.findByRole('button', { name: 'Bookmark' })
		rpc.mockImplementation((path) =>
			path.at(-1) === 'save'
				? Promise.reject(new Error('Offline'))
				: Promise.resolve({ bookmarked: false })
		)
		fireEvent.click(save)
		await screen.findByText('Unable to update bookmark. Please try again.')
		expect(
			screen
				.getByRole('button', { name: 'Bookmark' })
				.getAttribute('aria-pressed')
		).toBe('false')
		expect(toast).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'error' })
		)
	})
	it('separates cached state when switching accounts', async () => {
		rpc
			.mockResolvedValueOnce({ bookmarked: true })
			.mockResolvedValue({ bookmarked: false })
		const rendered = view(<ProjectActions {...actionProps} />)
		await screen.findByRole('button', { name: 'Remove bookmark' })
		rendered.rerender(<ProjectActions {...actionProps} userId="user-b" />)
		await waitFor(() =>
			expect(
				screen
					.getByRole('button', { name: 'Bookmark' })
					.hasAttribute('disabled')
			).toBe(false)
		)
		expect(
			rendered.queryClient.getQueryData(
				bookmarkQueries.state(actionProps.projectId, 'user-b').queryKey
			)
		).toEqual({ bookmarked: false })
		expect(bookmarkQueries.list({}, 'user-a').queryKey).not.toEqual(
			bookmarkQueries.list({}, 'user-b').queryKey
		)
	})
})

describe('bookmarks table and navigation', () => {
	const project = {
		id: 'project-id',
		slug: 'example',
		name: 'Example',
		logo: 'projects/example/logo.png',
		tagline: 'Short tagline',
	}
	const pagination = {
		page: 1,
		limit: 25,
		totalItems: 1,
		totalPages: 1,
		hasNextPage: false,
		hasPreviousPage: false,
	}
	it('renders exactly three columns, a public project link, tagline and one Remove button per row', async () => {
		rpc.mockRejectedValue(new Error('Offline'))
		view(
			<BookmarkDataTable
				data={{ bookmarks: [project], pagination }}
				userId="user-a"
				onPageChange={vi.fn()}
			/>
		)
		const table = screen.getByRole('table', { name: 'Your bookmarks' })
		expect(
			within(table)
				.getAllByRole('columnheader')
				.map((header) => header.textContent)
		).toEqual(['Name', 'Description', 'Action'])
		expect(
			within(table).getByRole('link', { name: 'Example' }).getAttribute('href')
		).toBe('/example')
		expect(within(table).getByText('Short tagline')).toBeTruthy()
		expect(within(table).getAllByRole('button')).toHaveLength(1)
		fireEvent.click(within(table).getByRole('button'))
		await screen.findByText('Unable to remove. Try again.')
		expect(within(table).getByRole('link', { name: 'Example' })).toBeTruthy()
		expect(rpc.mock.calls[0]).toEqual([
			['bookmark', 'remove'],
			{ params: { id: project.id } },
			expect.anything(),
		])
	})
	it('shows an empty state and working pagination', () => {
		const next = vi.fn()
		view(
			<BookmarkDataTable
				data={{
					bookmarks: [],
					pagination: {
						...pagination,
						totalItems: 26,
						totalPages: 2,
						hasNextPage: true,
					},
				}}
				userId="user-a"
				onPageChange={next}
			/>
		)
		expect(screen.getByText('No bookmarks yet')).toBeTruthy()
		fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
		expect(next).toHaveBeenCalledWith(2)
		expect(
			screen
				.getByRole('button', {
					name: 'Previous page',
				})
				.hasAttribute('disabled')
		).toBe(true)
	})
	it.each(['user', 'admin'])(
		'enables the account Bookmarks item for %s',
		async (role) => {
			view(
				<Header
					auth={
						{
							user: { id: 'user-a', name: 'Test', role },
							session: {},
						} as React.ComponentProps<typeof Header>['auth']
					}
				/>
			)
			fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }))
			const item = await screen.findByRole('menuitem', { name: 'Bookmarks' })
			expect(item.getAttribute('href')).toBe('/bookmarks')
			expect(item.getAttribute('aria-disabled')).not.toBe('true')
		}
	)
})
