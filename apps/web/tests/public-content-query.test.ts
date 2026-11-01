// @vitest-environment node
import { QueryClient, dehydrate, hydrate } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import {
	emptyPublicContent,
	publicContentQueryKey,
} from '#/features/public-content/model'
import { publicContentOptions } from '#/features/public-content/queries'
import {
	preparePublicContent,
	preparePublicBlogContent,
} from '#/features/public-content/server-function'

vi.mock('#/features/public-content/server-function', () => {
	return { preparePublicContent: vi.fn(), preparePublicBlogContent: vi.fn() }
})
vi.mock('evlog/client', () => {
	return { log: { warn: vi.fn() } }
})

const clients: Array<QueryClient> = []
function client() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	clients.push(queryClient)
	return queryClient
}
beforeEach(() => {
	vi.mocked(preparePublicBlogContent)
		.mockReset()
		.mockResolvedValue(emptyPublicContent())
	vi.mocked(preparePublicContent)
		.mockReset()
		.mockResolvedValue(emptyPublicContent())
})
afterEach(() => clients.splice(0).forEach((queryClient) => queryClient.clear()))

describe('public content cache', () => {
	it('separates blog and project cache entries and keeps blog Markdown available on enhancement failure', async () => {
		const queryClient = client()
		await queryClient.query(publicContentOptions('same-slug', 'Content'))
		const options = publicContentOptions('same-slug', 'Content', 'blog')
		await queryClient.query(options)
		expect(preparePublicContent).toHaveBeenCalledTimes(1)
		expect(preparePublicBlogContent).toHaveBeenCalledExactlyOnceWith({
			data: { slug: 'same-slug' },
		})
		vi.mocked(preparePublicBlogContent).mockRejectedValueOnce(
			new Error('offline')
		)
		await queryClient.invalidateQueries({ queryKey: publicContentQueryKey })
		expect(await queryClient.query(options)).toEqual(emptyPublicContent())
	})
	it('sends only the slug to prepare stored public documentation', async () => {
		await client().query(publicContentOptions('source', '# Stored content'))
		expect(preparePublicContent).toHaveBeenCalledExactlyOnceWith({
			data: { slug: 'source' },
		})
	})

	it('reuses SSR preparation after hydration, then refreshes for content, slug and catalog changes', async () => {
		const server = client()
		const options = publicContentOptions('first', 'Original')
		await server.query(options)
		const browser = client()
		hydrate(browser, structuredClone(dehydrate(server)))
		await browser.query(options)
		expect(preparePublicContent).toHaveBeenCalledTimes(1)
		await browser.query(publicContentOptions('first', 'Updated'))
		await browser.query(publicContentOptions('second', 'Updated'))
		expect(preparePublicContent).toHaveBeenCalledTimes(3)
		await browser.invalidateQueries({ queryKey: publicContentQueryKey })
		await browser.query(options)
		expect(preparePublicContent).toHaveBeenCalledTimes(4)
	})

	it('keeps plain Markdown available on preparation failure and retries after invalidation', async () => {
		vi.mocked(preparePublicContent).mockRejectedValueOnce(new Error('offline'))
		const queryClient = client()
		const options = publicContentOptions('source', '# Content')
		expect(await queryClient.query(options)).toEqual(emptyPublicContent())
		await queryClient.invalidateQueries({ queryKey: publicContentQueryKey })
		await queryClient.query(options)
		expect(preparePublicContent).toHaveBeenCalledTimes(2)
	})

	it('skips the server for empty documentation', async () => {
		expect(await client().query(publicContentOptions('source', ''))).toEqual(
			emptyPublicContent()
		)
		expect(preparePublicContent).not.toHaveBeenCalled()
	})
})
