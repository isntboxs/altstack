// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import type { ORPCRouterClient, ORPCRouterOutputs } from '@altstack/api/routers'

import { GithubStatisticsRefresh } from '#/features/admin-projects/components/github-statistics-refresh'
import { adminProjectQueries } from '#/features/admin-projects/queries'
import { projectQueries } from '#/features/project/queries'

const { rpc, toastAdd } = vi.hoisted(() => {
	return {
		rpc: vi.fn<(path: Array<string>, input: unknown) => Promise<unknown>>(),
		toastAdd: vi.fn(),
	}
})
vi.mock('@altstack/ui/components/toast', () => {
	return { toast: { add: toastAdd } }
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
const id = '550e8400-e29b-41d4-a716-446655440000'
const url = 'https://github.com/owner/repo'
const statistics: ORPCRouterOutputs['admin']['project']['githubRefresh'] = {
	repositoryUrl: url,
	github: {
		owner: 'owner',
		repo: 'repo',
		stars: 99,
		forks: 9,
		fetchedAt: new Date(),
		lastCommitAt: null,
		repositoryCreatedAt: new Date(),
		latestReleaseTag: null,
		metadataFetchedAt: new Date(),
	},
}
let queryClient: QueryClient
beforeEach(() => {
	queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	})
	rpc.mockReset().mockResolvedValue(statistics)
	toastAdd.mockClear()
})
afterEach(() => {
	cleanup()
	queryClient.clear()
})
function view(disabled = false) {
	return render(
		<QueryClientProvider client={queryClient}>
			<GithubStatisticsRefresh
				projectId={id}
				repositoryUrl={url}
				disabled={disabled}
			/>
		</QueryClientProvider>
	)
}
describe('admin GitHub refresh', () => {
	it('calls the saved project once, disables during fetch, invalidates related queries, and reports success', async () => {
		let finish!: (value: typeof statistics) => void
		rpc.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve
				})
		)
		const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
		const keys = [
			adminProjectQueries.get({ id }).queryKey,
			adminProjectQueries.list().queryKey,
			projectQueries.bySlug('example').queryKey,
			projectQueries.search({}).queryKey,
		]
		for (const key of keys) queryClient.setQueryData<unknown>(key, {})
		view()
		fireEvent.click(
			screen.getByRole('button', { name: 'Refresh GitHub stats' })
		)
		await waitFor(() =>
			expect(
				screen.getByRole('button', { name: 'Refreshing GitHub stats…' })
			).toHaveProperty('disabled', true)
		)
		expect(rpc).toHaveBeenCalledExactlyOnceWith(
			['admin', 'project', 'githubRefresh'],
			{ params: { id } },
			expect.anything()
		)
		await act(async () => {
			finish(statistics)
			await Promise.resolve()
		})
		await waitFor(() =>
			expect(toastAdd).toHaveBeenCalledWith({
				type: 'success',
				title: 'GitHub statistics refreshed',
			})
		)
		for (const key of keys) {
			expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
		}
		expect(invalidate).toHaveBeenCalled()
	})
	it('reports failures without retry or invalidating stored data', async () => {
		rpc.mockRejectedValue(new Error('GitHub is temporarily unavailable'))
		const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
		view()
		fireEvent.click(
			screen.getByRole('button', { name: 'Refresh GitHub stats' })
		)
		await waitFor(() =>
			expect(toastAdd).toHaveBeenCalledWith({
				type: 'error',
				title: 'GitHub refresh failed',
				description: 'GitHub is temporarily unavailable',
			})
		)
		expect(rpc).toHaveBeenCalledTimes(1)
		expect(invalidate).not.toHaveBeenCalled()
		expect(
			screen.getByRole('button', { name: 'Refresh GitHub stats' })
		).toHaveProperty('disabled', false)
	})
	it('respects a pending form save', () => {
		view(true)
		fireEvent.click(
			screen.getByRole('button', { name: 'Refresh GitHub stats' })
		)
		expect(rpc).not.toHaveBeenCalled()
	})
})
