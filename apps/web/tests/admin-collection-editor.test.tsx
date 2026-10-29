// @vitest-environment jsdom
import { createORPCClient } from '@orpc/client'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from '@tanstack/react-router'
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterClient, ORPCRouterOutputs } from '@altstack/api/routers'

import { CollectionEditor } from '#/features/admin-collections/editor'
const { rpc } = vi.hoisted(() => {
	return {
		rpc: vi.fn<(path: Array<string>, input: unknown) => Promise<unknown>>(),
	}
})
vi.mock('#/utils/orpc', () => {
	return {
		orpc: createTanstackQueryUtils(
			createORPCClient<ORPCRouterClient>({ call: rpc })
		),
	}
})
vi.mock('#/features/admin-projects/queries', () => {
	return {
		adminProjectQueries: {
			list: () => {
				return {
					queryKey: ['candidates'],
					queryFn: () => rpc(['candidates'], {}),
				}
			},
		},
	}
})
vi.mock('#/components/block-note/editor', async () => {
	const { useImperativeHandle, useState } = await import('react')
	return {
		default: function MockEditor({
			ref,
			value,
			onChange,
		}: {
			ref: React.Ref<{ flush: () => void; readMarkdown: () => string }>
			value: string
			onChange: (value: string) => void
		}) {
			const [text, setText] = useState(value)
			useImperativeHandle(ref, () => {
				return {
					flush: () => undefined,
					readMarkdown: () => text,
				}
			})
			return (
				<textarea
					aria-label="Markdown editor"
					value={text}
					onChange={(event) => {
						setText(event.target.value)
						onChange(event.target.value)
					}}
				/>
			)
		},
	}
})
vi.mock('#/components/public-content', () => {
	return {
		PublicContent: ({ content }: { content: string }) => (
			<article>{content}</article>
		),
	}
})
vi.mock('@altstack/env/web', () => {
	return {
		env: { VITE_S3_PUBLIC_URL: 'https://storage.test' },
	}
})
const first = {
	id: '550e8400-e29b-41d4-a716-446655440001',
	name: 'First tool',
	slug: 'first',
	description: 'First',
	logo: null,
	screenshot: null,
	content: 'Project content',
	websiteUrl: null,
	repositoryUrl: 'https://github.com/test/first',
	status: 'published',
}
const second = {
	...first,
	id: '550e8400-e29b-41d4-a716-446655440002',
	name: 'Second tool',
	slug: 'second',
}
const target = {
	...first,
	id: '550e8400-e29b-41d4-a716-446655440003',
	name: 'Target tool',
	slug: 'target',
}
const initial: ORPCRouterOutputs['admin']['collection']['getById'] = {
	id: '550e8400-e29b-41d4-a716-446655440004',
	name: 'Editorial list',
	slug: 'editorial-list',
	description: 'Written description',
	content: 'Written Markdown',
	kind: 'repository',
	sourceRepositoryUrl: 'https://github.com/test/list',
	mainProjectId: null,
	mainProject: null,
	status: 'draft',
	version: 7,
	updatedAt: new Date('2026-10-29T00:00:00Z'),
	authorName: 'Original writer',
	projects: [first, second],
}
const clients: Array<QueryClient> = []
beforeEach(() => {
	vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
	rpc.mockReset().mockImplementation((path) => {
		if (path.join('/') === 'candidates') {
			return Promise.resolve({
				projects: [first, second, target],
				pagination: { hasPreviousPage: false, hasNextPage: false },
			})
		}
		return Promise.resolve(initial)
	})
})
afterEach(() => {
	cleanup()
	for (const client of clients) client.clear()
	clients.length = 0
	vi.restoreAllMocks()
})
async function mount(existing?: typeof initial) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	})
	clients.push(client)
	const root = createRootRoute({ component: Outlet })
	const editor = createRoute({
		getParentRoute: () => root,
		path: '/editor',
		component: () => <CollectionEditor initial={existing} />,
	})
	const destination = createRoute({
		getParentRoute: () => root,
		path: '/admin/collections',
		component: () => <p>Collection directory</p>,
	})
	const router = createRouter({
		routeTree: root.addChildren([editor, destination]),
		history: createMemoryHistory({ initialEntries: ['/editor'] }),
	})
	await router.load()
	render(
		<QueryClientProvider client={client}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	)
	await screen.findAllByRole('button', { name: 'Add member' })
	return router
}
describe('collection admin editor', () => {
	it('creates with explicit editorial fields, canonical source, selected order and flushed Markdown', async () => {
		await mount()
		for (const [label, text] of [
			['Title', 'Community tools'],
			['Slug', 'community-tools'],
			['Description', 'Written description'],
			['Source repository URL', 'https://github.com/Community/Tools.git'],
		]) {
			fireEvent.change(screen.getByLabelText(label), {
				target: { value: text },
			})
		}
		fireEvent.change(screen.getByLabelText('Markdown editor'), {
			target: { value: 'Latest **Markdown**' },
		})
		const selector = screen.getByRole('region', { name: 'Project selector' })
		const add = within(selector).getAllByRole('button', { name: 'Add member' })
		fireEvent.click(add[1])
		fireEvent.click(add[0])
		fireEvent.click(screen.getByRole('button', { name: 'Move First tool up' }))
		fireEvent.change(screen.getByLabelText('Publication'), {
			target: { value: 'published' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save collection' }))
		await waitFor(() =>
			expect(
				rpc.mock.calls.find(
					([path]) => path.join('/') === 'admin/collection/create'
				)?.[1]
			).toEqual({
				body: {
					name: 'Community tools',
					slug: 'community-tools',
					description: 'Written description',
					content: 'Latest **Markdown**',
					kind: 'repository',
					sourceRepositoryUrl: 'https://github.com/community/tools',
					mainProjectId: null,
					status: 'published',
					projectIds: [first.id, second.id],
				},
			})
		)
		await screen.findByText('Collection directory')
	})
	it('sends revision on edits and retains unsaved text after a conflict without replacing the author', async () => {
		rpc.mockImplementation((path) =>
			path.join('/') === 'candidates'
				? Promise.resolve({ projects: [first, second, target], pagination: {} })
				: Promise.reject(
						new Error('This collection changed. Reload before saving.')
					)
		)
		await mount(initial)
		expect(screen.getByText(/Written by Original writer/)).toBeTruthy()
		fireEvent.change(screen.getByLabelText('Title'), {
			target: { value: 'Unsaved editorial title' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save collection' }))
		await screen.findByText('This collection changed. Reload before saving.')
		expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe(
			'Unsaved editorial title'
		)
		const call = rpc.mock.calls.find(
			([path]) => path.join('/') === 'admin/collection/update'
		)
		expect(call?.[1]).toMatchObject({
			params: { id: initial.id },
			body: { expectedVersion: 7, name: 'Unsaved editorial title' },
		})
		expect(call?.[1]).not.toHaveProperty('body.authorId')
	})
	it('discards unsaved fields and editor content even when the server revision is unchanged', async () => {
		await mount(initial)
		vi.spyOn(window, 'confirm').mockReturnValue(true)
		fireEvent.change(screen.getByLabelText('Title'), {
			target: { value: 'Unsaved title' },
		})
		fireEvent.change(screen.getByLabelText('Markdown editor'), {
			target: { value: 'Unsaved Markdown' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Discard and reload' }))
		await waitFor(() =>
			expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe(
				initial.name
			)
		)
		expect(
			screen.getByLabelText<HTMLTextAreaElement>('Markdown editor').value
		).toBe(initial.content)
	})

	it('switches from repository list to a listed main project without retaining a source URL', async () => {
		await mount(initial)
		fireEvent.change(screen.getByLabelText('Type'), {
			target: { value: 'ecosystem' },
		})
		expect(screen.queryByLabelText('Source repository URL')).toBeNull()
		const buttons = screen.getAllByRole('button', { name: 'Set main project' })
		fireEvent.click(buttons[2])
		fireEvent.click(screen.getByRole('button', { name: 'Save collection' }))
		await waitFor(() =>
			expect(
				rpc.mock.calls.find(
					([path]) => path.join('/') === 'admin/collection/update'
				)?.[1]
			).toMatchObject({
				body: {
					kind: 'ecosystem',
					mainProjectId: target.id,
					sourceRepositoryUrl: null,
					expectedVersion: 7,
				},
			})
		)
	})
})
