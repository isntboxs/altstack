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
} from '@testing-library/react'
import { useImperativeHandle, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { z } from 'zod'

import type { ORPCRouterClient } from '@altstack/api/routers'

import { aboutUpdateSchema, defaultAboutPage } from '@altstack/shared/schemas'

import { AboutEditor } from '#/features/about/editor'
import { aboutQueries } from '#/features/about/queries'

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
let queryClient: QueryClient
beforeEach(() => {
	rpc.mockReset().mockImplementation((_path, input) => {
		const { expectedVersion, ...body } = z
			.object({ body: aboutUpdateSchema })
			.parse(input).body
		return Promise.resolve({
			...body,
			version: expectedVersion + 1,
			updatedAt: new Date(),
		})
	})
	vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})
afterEach(() => {
	cleanup()
	queryClient.clear()
	vi.restoreAllMocks()
})
async function mount() {
	queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	})
	const root = createRootRoute({ component: Outlet })
	const editor = createRoute({
		getParentRoute: () => root,
		path: '/admin/about',
		component: () => <AboutEditor initial={defaultAboutPage} />,
	})
	const about = createRoute({
		getParentRoute: () => root,
		path: '/about',
		component: () => <p>Public About</p>,
	})
	const router = createRouter({
		routeTree: root.addChildren([editor, about]),
		history: createMemoryHistory({ initialEntries: ['/admin/about'] }),
	})
	await router.load()
	render(
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	)
	await screen.findByLabelText('Title')
	await screen.findByLabelText('Markdown editor')
}

describe('About editor', () => {
	it('saves the latest editor value, refreshes public data, and uses the new revision on a second save', async () => {
		await mount()
		const markdown =
			screen.getByLabelText<HTMLTextAreaElement>('Markdown editor')
		markdown.value = '## Latest content\n\nStill being typed.'
		fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
		await screen.findByText('About us saved. Your changes are live.')
		expect(rpc).toHaveBeenLastCalledWith(
			['admin', 'about', 'update'],
			{
				body: {
					title: defaultAboutPage.title,
					description: defaultAboutPage.description,
					content: markdown.value,
					expectedVersion: 0,
				},
			},
			expect.anything()
		)
		expect(queryClient.getQueryData(aboutQueries.get().queryKey)).toMatchObject(
			{ content: markdown.value, version: 1 }
		)
		fireEvent.change(screen.getByLabelText('Title'), {
			target: { value: 'Our story' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
		await screen.findByText('About us saved. Your changes are live.')
		const request = z
			.object({ body: aboutUpdateSchema })
			.parse(rpc.mock.calls.at(-1)?.[1])
		expect(request.body).toMatchObject({
			title: 'Our story',
			expectedVersion: 1,
		})
	})
	it('validates empty fields without sending a write', async () => {
		await mount()
		fireEvent.change(screen.getByLabelText('Title'), { target: { value: ' ' } })
		fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
		await waitFor(() =>
			expect(screen.getByLabelText('Title').getAttribute('aria-invalid')).toBe(
				'true'
			)
		)
		expect(rpc).not.toHaveBeenCalled()
	})
	it('keeps edits after a conflict and allows cancelling navigation away', async () => {
		rpc.mockRejectedValue(
			new ORPCError('CONFLICT', {
				message: 'This page changed. Reload the latest version before saving.',
			})
		)
		await mount()
		fireEvent.change(screen.getByLabelText('Title'), {
			target: { value: 'My unsaved story' },
		})
		fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
		await screen.findByText(
			'This page changed. Reload the latest version before saving.'
		)
		expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe(
			'My unsaved story'
		)
		fireEvent.click(screen.getByRole('link', { name: 'View public page' }))
		await screen.findByRole('alertdialog')
		fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
		await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
		expect(screen.getByLabelText<HTMLInputElement>('Title').value).toBe(
			'My unsaved story'
		)
		fireEvent.click(screen.getByRole('link', { name: 'View public page' }))
		await screen.findByRole('alertdialog')
		fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
		await screen.findByText('Public About')
	})
})
