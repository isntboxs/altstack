// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type * as RouterModule from '@tanstack/react-router'
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type {
	ORPCRouterClient,
	ORPCRouterInputs,
	ORPCRouterOutputs,
} from '@altstack/api/routers'

import { ProjectReviewHistory } from '#/features/admin-projects/components/project-review-history'
import { adminProjectQueries } from '#/features/admin-projects/queries'
import { Route } from '#/routes/_main/projects/$id.edit'

const { rpc, navigate, invalidate } = vi.hoisted(() => {
	return {
		rpc: vi.fn<(path: Array<string>, input: unknown) => Promise<unknown>>(),
		navigate: vi.fn().mockResolvedValue(undefined),
		invalidate: vi.fn().mockResolvedValue(undefined),
	}
})
vi.mock('#/utils/orpc', async () => {
	const { createORPCClient } = await import('@orpc/client')
	const { createTanstackQueryUtils } = await import('@orpc/tanstack-query')
	const client = createORPCClient<ORPCRouterClient>({ call: rpc })
	return {
		orpc: createTanstackQueryUtils(client),
		projectORPC: createTanstackQueryUtils(client.project, {
			prefix: 'project',
		}),
		categoryORPC: createTanstackQueryUtils(client.category, {
			prefix: 'category',
		}),
		adminORPC: {
			project: createTanstackQueryUtils(client.admin.project, {
				prefix: 'admin/project',
			}),
			category: createTanstackQueryUtils(client.admin.category, {
				prefix: 'admin/category',
			}),
		},
	}
})
vi.mock('@tanstack/react-router', async () => {
	const actual = await vi.importActual<typeof RouterModule>(
		'@tanstack/react-router'
	)
	return {
		...actual,
		useRouter: () => {
			return { navigate, invalidate }
		},
		ClientOnly: ({ children }: { children?: React.ReactNode }) => (
			<>{children}</>
		),
		Link: ({ children, to }: { children?: React.ReactNode; to: string }) => (
			<a href={to}>{children}</a>
		),
	}
})
vi.mock('#/components/block-note/editor', () => {
	return { default: () => null }
})
vi.mock('#/components/category-combobox', () => {
	return {
		CategoryCombobox: () => null,
	}
})
vi.mock('#/components/project-category-badges', () => {
	return {
		ProjectCategoryBadges: () => null,
	}
})
vi.mock('#/components/image-uploader', () => {
	return {
		LogoUploader: () => null,
		ScreenshotUploader: () => null,
	}
})
vi.mock('#/utils/storage', () => {
	return {
		resolveFileUrl: (value: string | null) => value,
	}
})
vi.mock('@altstack/ui/components/toast', () => {
	return { toast: { add: vi.fn() } }
})

const ID = '550e8400-e29b-41d4-a716-446655440000'
type History = ORPCRouterOutputs['admin']['project']['reviewHistory']
type Event = History['events'][number]
const draft: ORPCRouterOutputs['admin']['project']['getById'] = {
	id: ID,
	name: 'Review Tool',
	slug: 'review-tool',
	repositoryUrl: 'https://github.com/review/example',
	tagline: null,
	description: null,
	logo: null,
	screenshot: null,
	content: null,
	websiteUrl: null,
	categories: [],
	status: 'draft',
	createdAt: new Date(),
	updatedAt: new Date(),
	submitterId: null,
	submitter: null,
	rejectionReason: null,
	github: {
		owner: 'review',
		repo: 'example',
		stars: 0,
		forks: 0,
		fetchedAt: new Date(),
		lastCommitAt: null,
		repositoryCreatedAt: null,
		latestReleaseTag: null,
		metadataFetchedAt: null,
	},
}
function event(index: number, overrides: Partial<Event> = {}): Event {
	return {
		id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
		action: 'project_status_changed',
		createdAt: new Date('2026-01-02T03:04:00Z'),
		actor: { id: ID, name: 'Reviewer' },
		reason: null,
		fromStatus: 'draft',
		toStatus: 'published',
		...overrides,
	}
}
function page(
	events: Array<Event>,
	pageNumber = 1,
	totalItems = events.length
): History {
	return {
		events,
		pagination: {
			page: pageNumber,
			limit: 20,
			totalItems,
			totalPages: Math.ceil(totalItems / 20),
			hasNextPage: pageNumber * 20 < totalItems,
			hasPreviousPage: pageNumber > 1,
		},
	}
}
function mount(editPage = false) {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Infinity },
			mutations: { retry: false },
		},
	})
	queryClient.setQueryData(adminProjectQueries.get({ id: ID }).queryKey, draft)
	const Component = Route.options.component
	if (!Component) throw new Error('Missing edit route component')
	const view = render(
		<QueryClientProvider client={queryClient}>
			{editPage ? <Component /> : <ProjectReviewHistory projectId={ID} />}
		</QueryClientProvider>
	)
	return { ...view, queryClient }
}
const historyCalls = () =>
	rpc.mock.calls.filter(([path]) => path.at(-1) === 'reviewHistory')

beforeEach(() => {
	rpc.mockReset().mockResolvedValue(page([]))
	navigate.mockClear()
	invalidate.mockClear()
	vi.spyOn(Route, 'useParams').mockReturnValue({ id: ID })
})
afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
})

describe('admin review history UI', () => {
	it('shows loading independently from the usable edit form, followed by empty history', async () => {
		const pending = Promise.withResolvers<History>()
		rpc.mockReturnValue(pending.promise)
		mount(true)
		expect(screen.getByRole('status').textContent).toBe(
			'Loading review history…'
		)
		expect(
			screen
				.getByRole('button', { name: 'Save Draft' })
				.hasAttribute('disabled')
		).toBe(false)
		fireEvent.change(screen.getByLabelText('Tagline'), {
			target: { value: 'Still editable' },
		})
		await act(async () => {
			pending.resolve(page([]))
			await pending.promise
		})
		expect(await screen.findByText('No review history yet.')).toBeTruthy()
		expect(screen.getByLabelText('Tagline')).toHaveProperty(
			'value',
			'Still editable'
		)
		expect(historyCalls()[0]?.[1]).toEqual({
			params: { id: ID },
			query: { page: 1, limit: 20 },
		})
	})
	it('shows an error and retries without disabling moderation or losing edits', async () => {
		rpc
			.mockRejectedValueOnce(new Error('History unavailable'))
			.mockResolvedValue(page([]))
		mount(true)
		expect((await screen.findByRole('alert')).textContent).toBe(
			'Unable to load review history.'
		)
		expect(
			screen.getByRole('button', { name: 'Reject' }).hasAttribute('disabled')
		).toBe(false)
		fireEvent.change(screen.getByLabelText('Rejection reason (optional)'), {
			target: { value: 'Preserved reason' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
		expect(await screen.findByText('No review history yet.')).toBeTruthy()
		expect(historyCalls()).toHaveLength(2)
		expect(screen.getByLabelText('Rejection reason (optional)')).toHaveProperty(
			'value',
			'Preserved reason'
		)
	})
	it('shows actors, neutral null actors, readable transitions, timestamps and reasons without deduplicating events', async () => {
		rpc.mockResolvedValue(
			page([
				event(1, {
					toStatus: 'rejected',
					reason: 'Needs documentation\nAdd setup steps.',
				}),
				event(2, {
					toStatus: 'rejected',
					reason: 'Needs documentation\nAdd setup steps.',
				}),
				event(3, {
					action: 'project_submitted',
					actor: null,
					fromStatus: null,
					toStatus: 'draft',
				}),
				event(4, {
					action: 'project_created',
					fromStatus: null,
					toStatus: null,
				}),
				event(5, { fromStatus: null, toStatus: 'published' }),
				event(6, { fromStatus: 'rejected', toStatus: null }),
			])
		)
		const view = mount()
		expect(await screen.findByText('Unknown user')).toBeTruthy()
		expect(screen.getAllByText('Draft → Rejected')).toHaveLength(2)
		expect(screen.getAllByText(/Needs documentation/)).toHaveLength(2)
		expect(screen.getByText('To Draft')).toBeTruthy()
		expect(screen.getByText('To Published')).toBeTruthy()
		expect(screen.getByText('From Rejected')).toBeTruthy()
		expect(screen.getByText(/Created project/)).toBeTruthy()
		expect(screen.getByText(/Submitted project/)).toBeTruthy()
		const times = view.container.querySelectorAll('time')
		expect(times).toHaveLength(6)
		expect(times[0]?.dateTime).toBe('2026-01-02T03:04:00.000Z')
		expect(times[0]?.textContent).toContain('2026')
		expect(screen.getByText('Showing 6 of 6 review events.')).toBeTruthy()
	})
	it('loads older pages and retains current entries on failure, then retries the older page', async () => {
		const first = Array.from({ length: 20 }, (_, index) => event(index + 1))
		rpc
			.mockResolvedValueOnce(page(first, 1, 21))
			.mockRejectedValueOnce(new Error('Older page unavailable'))
			.mockResolvedValueOnce(
				page([event(21, { actor: { id: ID, name: 'Older reviewer' } })], 2, 21)
			)
		mount()
		fireEvent.click(
			await screen.findByRole('button', { name: 'Load older entries' })
		)
		expect((await screen.findByRole('alert')).textContent).toBe(
			'Unable to load older review history.'
		)
		expect(screen.getAllByRole('listitem')).toHaveLength(20)
		fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
		expect(await screen.findByText('Older reviewer')).toBeTruthy()
		expect(screen.getAllByRole('listitem')).toHaveLength(21)
		expect(historyCalls().map(([, input]) => input)).toEqual([
			{ params: { id: ID }, query: { page: 1, limit: 20 } },
			{ params: { id: ID }, query: { page: 2, limit: 20 } },
			{ params: { id: ID }, query: { page: 2, limit: 20 } },
		])
		expect(
			screen.queryByRole('button', { name: 'Load older entries' })
		).toBeNull()
	})
	it('uses a separate history query when the project changes', async () => {
		const view = mount()
		await screen.findByText('No review history yet.')
		const otherId = '550e8400-e29b-41d4-a716-446655440001'
		view.rerender(
			<QueryClientProvider client={view.queryClient}>
				<ProjectReviewHistory projectId={otherId} />
			</QueryClientProvider>
		)
		await waitFor(() => expect(historyCalls()).toHaveLength(2))
		expect(historyCalls()[1]?.[1]).toEqual({
			params: { id: otherId },
			query: { page: 1, limit: 20 },
		})
	})
	it.each(['Save Draft', 'Reject'])(
		'refetches history after %s while staying on the same project edit page',
		async (action) => {
			let saved = false
			rpc.mockImplementation((path, input) => {
				if (path.at(-1) === 'update') {
					saved = true
					const update = input as ORPCRouterInputs['admin']['project']['update']
					return Promise.resolve({ ...draft, ...update.body })
				}
				if (path.at(-1) === 'getById') {
					return Promise.resolve({
						...draft,
						status: saved && action === 'Reject' ? 'rejected' : 'draft',
					})
				}
				return Promise.resolve(
					page(
						saved && action === 'Reject'
							? [
									event(2, {
										toStatus: 'rejected',
										reason: 'Needs documentation',
									}),
								]
							: []
					)
				)
			})
			mount(true)
			await screen.findByText('No review history yet.')
			fireEvent.change(screen.getByLabelText('Rejection reason (optional)'), {
				target: { value: 'Needs documentation' },
			})
			fireEvent.click(screen.getByRole('button', { name: action }))
			await waitFor(() => expect(historyCalls()).toHaveLength(2))
			expect(navigate).not.toHaveBeenCalled()
			await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1))
			const section = screen.getByRole('region', { name: 'Review history' })
			expect(within(section).queryByText('Draft → Rejected') !== null).toBe(
				action === 'Reject'
			)
			expect(within(section).queryByText(/Needs documentation/) !== null).toBe(
				action === 'Reject'
			)
			expect(
				screen.queryByRole('button', { name: 'Restore to Draft' }) !== null
			).toBe(action === 'Reject')
		}
	)
	it('refreshes every loaded history page after moderation without losing or duplicating events', async () => {
		let events = Array.from({ length: 21 }, (_, index) => event(index + 1))
		rpc.mockImplementation((path, input) => {
			if (path.at(-1) === 'update') {
				events = [
					event(22, { toStatus: 'rejected', reason: 'Newest rejection' }),
					...events,
				]
				return Promise.resolve({ ...draft, status: 'rejected' })
			}
			if (path.at(-1) === 'getById') {
				return Promise.resolve({ ...draft, status: 'rejected' })
			}
			const { query } =
				input as ORPCRouterInputs['admin']['project']['reviewHistory']
			const pageNumber = Number(query.page)
			return Promise.resolve(
				page(
					events.slice((pageNumber - 1) * 20, pageNumber * 20),
					pageNumber,
					events.length
				)
			)
		})
		mount(true)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Load older entries' })
		)
		await screen.findByText('Showing 21 of 21 review events.')
		fireEvent.click(screen.getByRole('button', { name: 'Reject' }))
		expect(
			await screen.findByText('Showing 22 of 22 review events.')
		).toBeTruthy()
		expect(
			historyCalls().map(
				([, input]) =>
					(input as ORPCRouterInputs['admin']['project']['reviewHistory']).query
						.page
			)
		).toEqual([1, 2, 1, 2])
		expect(
			within(
				screen.getByRole('region', { name: 'Review history' })
			).getAllByRole('listitem')
		).toHaveLength(22)
		expect(screen.getByText(/Newest rejection/)).toBeTruthy()
	})
})
