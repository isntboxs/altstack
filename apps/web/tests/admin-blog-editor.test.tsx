// @vitest-environment jsdom
import { createORPCClient, ORPCError } from '@orpc/client'
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
import { useImperativeHandle, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterClient, ORPCRouterOutputs } from '@altstack/api/routers'

import { BlogEditor } from '#/features/admin-blogs/editor'
import { Route as BlogListRoute } from '#/routes/_main/admin.blogs/index'

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
		client: createORPCClient<ORPCRouterClient>({ call: rpc }),
	}
})
const initial: ORPCRouterOutputs['admin']['blog']['getById'] = {
	id: '550e8400-e29b-41d4-a716-446655440004',
	title: 'A tech article',
	slug: 'a-tech-article',
	description: 'An article about software.',
	coverUrl: 'https://images.example.test/cover.webp',
	content: '## Introduction\n\nArticle content.',
	status: 'draft',
	version: 7,
	readTime: 1,
	authorName: 'Original author',
	authorImage: null,
	publishedAt: null,
	updatedAt: new Date('2026-10-01T00:00:00Z'),
}
let client: QueryClient
beforeEach(() => {
	rpc.mockReset().mockResolvedValue(initial)
	vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})
afterEach(() => {
	cleanup()
	client.clear()
	vi.restoreAllMocks()
})
async function mount(existing?: typeof initial) {
	client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	})
	const root = createRootRoute({ component: Outlet })
	const editor = createRoute({
		getParentRoute: () => root,
		path: '/editor',
		component: () => <BlogEditor initial={existing} />,
	})
	const destination = createRoute({
		getParentRoute: () => root,
		path: '/admin/blogs',
		component: () => <p>Blog directory</p>,
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
	await screen.findByLabelText('Title')
	await screen.findByLabelText('Markdown editor')
	return router
}
describe('admin blog editor', () => {
	it('previews link favicons and saves the original Markdown after changing a failed destination', async () => {
		await mount({
			...initial,
			content: '[Docs](https://example.com/guide) [About](/about)',
		})
		fireEvent.click(screen.getByRole('button', { name: 'Preview content' }))
		const preview = screen.getByRole('region', { name: 'Markdown preview' })
		const docs = within(preview).getByRole('link', { name: /Docs/ })
		expect(docs.querySelector('img')?.getAttribute('src')).toContain(
			'domain=example.com'
		)
		expect(
			within(preview)
				.getByRole('link', { name: 'About' })
				.querySelector('img')
				?.getAttribute('src')
		).toBe('/favicon.svg')
		fireEvent.error(docs.querySelector('img')!)
		expect(docs.querySelector('img')).toBeNull()

		const content = '[Docs](https://docs.example.org/start) [About](/about)'
		fireEvent.change(screen.getByLabelText('Markdown editor'), {
			target: { value: content },
		})
		expect(
			within(preview)
				.getByRole('link', { name: /Docs/ })
				.querySelector('img')
				?.getAttribute('src')
		).toContain('domain=docs.example.org')
		fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
		await screen.findByText('Blog directory')
		expect(
			rpc.mock.calls.find(([path]) => path.at(-1) === 'update')?.[1]
		).toMatchObject({ body: { content } })
	})

	it('confirms deletion with the displayed revision and refreshes the admin list', async () => {
		let posts = [initial]
		rpc.mockImplementation((path) => {
			if (path.at(-1) === 'delete') {
				posts = []
				return Promise.resolve({ success: true })
			}
			return Promise.resolve({ posts, total: posts.length })
		})
		client = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false },
			},
		})
		const root = createRootRoute({ component: Outlet })
		const list = createRoute({
			getParentRoute: () => root,
			path: '/admin/blogs',
			component: BlogListRoute.options.component,
		})
		const router = createRouter({
			routeTree: root.addChildren([list]),
			history: createMemoryHistory({ initialEntries: ['/admin/blogs'] }),
		})
		await router.load()
		render(
			<QueryClientProvider client={client}>
				<RouterProvider router={router} />
			</QueryClientProvider>
		)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Delete A tech article' })
		)
		await screen.findByRole('alertdialog')
		fireEvent.click(screen.getByRole('button', { name: 'Delete blog' }))
		await screen.findByText('No blogs yet')
		expect(rpc).toHaveBeenCalledWith(
			['admin', 'blog', 'delete'],
			{ params: { id: initial.id }, body: { expectedVersion: 7 } },
			expect.anything()
		)
	})
	it('creates a draft with an automatic slug and retains a manually customized slug', async () => {
		await mount()
		fireEvent.change(screen.getByLabelText('Title'), {
			target: { value: 'Tools for developers' },
		})
		expect(screen.getByLabelText<HTMLInputElement>('Slug').value).toBe(
			'tools-for-developers'
		)
		fireEvent.change(screen.getByLabelText('Slug'), {
			target: { value: 'custom-slug' },
		})
		fireEvent.change(screen.getByLabelText('Title'), {
			target: { value: 'New tech article' },
		})
		fireEvent.change(screen.getByLabelText('Description'), {
			target: { value: initial.description },
		})
		fireEvent.click(screen.getByRole('tab', { name: 'Image URL' }))
		fireEvent.change(screen.getByLabelText('Cover image URL'), {
			target: { value: initial.coverUrl },
		})
		fireEvent.change(screen.getByLabelText('Markdown editor'), {
			target: { value: initial.content },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
		await screen.findByText('Blog directory')
		expect(rpc).toHaveBeenCalledWith(
			['admin', 'blog', 'create'],
			expect.objectContaining({
				body: {
					title: 'New tech article',
					slug: 'custom-slug',
					description: initial.description,
					coverUrl: initial.coverUrl,
					content: initial.content,
					status: 'draft',
				},
			}),
			expect.anything()
		)
	})

	it('waits for cover upload and saves the temporary key with the latest editor contents', async () => {
		await mount(initial)
		fireEvent.click(screen.getByRole('tab', { name: 'Upload image' }))
		fireEvent.click(screen.getByRole('button', { name: 'Start cover upload' }))
		expect(
			screen.getByRole<HTMLButtonElement>('button', {
				name: 'Uploading cover…',
			}).disabled
		).toBe(true)
		expect(
			screen
				.getByRole('tab', { name: 'Image URL' })
				.getAttribute('aria-disabled')
		).toBe('true')
		fireEvent.click(screen.getByRole('button', { name: 'Finish cover upload' }))
		const editor = screen.getByLabelText<HTMLTextAreaElement>('Markdown editor')
		// Save reads the editor directly even before a deferred onChange reaches React.
		editor.value = '## Latest content\n\nJust typed.'
		fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
		await screen.findByText('Blog directory')
		const call = rpc.mock.calls.find(([path]) => path.at(-1) === 'update')
		expect(call?.[1]).toMatchObject({
			body: {
				coverUrl: 'tmp/screenshots/cover-1.png',
				content: '## Latest content\n\nJust typed.',
			},
		})
	})
	it('validates required fields before mutation and focuses the first invalid input', async () => {
		await mount()
		fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
		await waitFor(() =>
			expect(screen.getByLabelText('Title').getAttribute('aria-invalid')).toBe(
				'true'
			)
		)
		expect(document.activeElement).toBe(screen.getByLabelText('Title'))
		expect(rpc).not.toHaveBeenCalled()
	})
	it('restores the saved cover after an upload expires without losing text edits', async () => {
		rpc.mockRejectedValueOnce(
			new ORPCError('UPLOAD_EXPIRED', {
				message: 'Upload expired. Please upload the image again.',
			})
		)
		await mount(initial)
		fireEvent.click(screen.getByRole('tab', { name: 'Upload image' }))
		fireEvent.click(screen.getByRole('button', { name: 'Finish cover upload' }))
		fireEvent.change(screen.getByLabelText('Title'), {
			target: { value: 'Edited title' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
		await screen.findByText('Upload expired. Please upload the image again.')
		fireEvent.click(screen.getByRole('tab', { name: 'Image URL' }))
		expect(
			screen.getByLabelText<HTMLInputElement>('Cover image URL').value
		).toBe(initial.coverUrl)
		expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe(
			'Edited title'
		)
	})
	it('updates with the loaded revision and supports publishing from a draft', async () => {
		await mount(initial)
		fireEvent.change(screen.getByLabelText('Status'), {
			target: { value: 'published' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }))
		await screen.findByText('Blog directory')
		expect(rpc).toHaveBeenCalledWith(
			['admin', 'blog', 'update'],
			expect.objectContaining({
				params: { id: initial.id },
				body: {
					title: initial.title,
					slug: initial.slug,
					description: initial.description,
					coverUrl: initial.coverUrl,
					content: initial.content,
					status: 'published',
					expectedVersion: 7,
				},
			}),
			expect.anything()
		)
	})
	it('preserves unsaved content when a save conflicts and protects navigation away', async () => {
		rpc.mockRejectedValue(
			new ORPCError('CONFLICT', {
				message: 'This blog changed. Reload before saving.',
			})
		)
		await mount(initial)
		fireEvent.change(screen.getByLabelText('Title'), {
			target: { value: 'My unsaved title' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
		await screen.findByText('This blog changed. Reload before saving.')
		expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe(
			'My unsaved title'
		)
		fireEvent.click(screen.getByRole('link', { name: 'Cancel' }))
		await screen.findByRole('alertdialog')
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
		expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe(
			'My unsaved title'
		)
	})
})

vi.mock('#/features/public-content/server-function', () => {
	return {
		preparePublicContent: vi.fn(),
		preparePublicBlogContent: vi.fn(),
	}
})

vi.mock('@altstack/env/web', () => {
	return {
		env: {
			VITE_APP_URL: 'https://altstack.test',
			VITE_S3_PUBLIC_URL: 'https://storage.test',
		},
	}
})

vi.mock('#/components/block-note/editor', () => {
	return {
		default: function MockEditor({
			ref,
			value = '',
			onChange,
		}: {
			ref: React.Ref<{ flush: () => void; readMarkdown: () => string }>
			value?: string
			onChange?: (content: string) => void
		}) {
			const input = useRef<HTMLTextAreaElement>(null)
			useImperativeHandle(ref, () => {
				return {
					flush: () => undefined,
					readMarkdown: () => input.current?.value ?? value,
				}
			})
			return (
				<textarea
					aria-label="Markdown editor"
					ref={input}
					defaultValue={value}
					onChange={(event) => onChange?.(event.target.value)}
				/>
			)
		},
	}
})
vi.mock('#/components/image-uploader', () => {
	return {
		CoverUploader: ({
			onChange,
			onBusyChange,
		}: {
			onChange: (value: string) => void
			onBusyChange: (busy: boolean) => void
		}) => (
			<div>
				<button type="button" onClick={() => onBusyChange(true)}>
					Start cover upload
				</button>
				<button
					type="button"
					onClick={() => {
						onChange('tmp/screenshots/cover-1.png')
						onBusyChange(false)
					}}
				>
					Finish cover upload
				</button>
			</div>
		),
	}
})
