import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'

import {
	publicOgBlog,
	publicOgCategory,
	publicOgProject,
} from '@altstack/api/queries/seo'

import { renderCard } from '#/features/seo/og/card'
import { loadProjectLogo } from '#/features/seo/og/logo.server'
import { ogResponse } from '#/features/seo/og/response.server'

vi.mock('@altstack/api/queries/seo', () => {
	return {
		publicOgBlog: vi.fn(),
		publicOgCategory: vi.fn(),
		publicOgProject: vi.fn(),
	}
})
vi.mock('#/features/seo/og/card', () => {
	return { renderCard: vi.fn() }
})
vi.mock('#/features/seo/og/logo.server', () => {
	return { loadProjectLogo: vi.fn() }
})
const fixture = () => {
	return {
		id: randomUUID(),
		slug: 'article',
		title: 'A published article',
		description: 'Editorial description',
		coverUrl: 'https://external.test/cover.jpg',
		authorName: 'Article author',
		readTime: 5,
		publishedAt: new Date('2026-10-01T00:00:00Z'),
		updatedAt: new Date('2026-10-02T00:00:00Z'),
	}
}
beforeEach(() => {
	vi.mocked(publicOgBlog).mockReset()
	vi.mocked(publicOgCategory).mockReset()
	vi.mocked(publicOgProject).mockReset()
	vi.mocked(renderCard)
		.mockReset()
		.mockResolvedValue(new Uint8Array([137, 80, 78, 71]))
	vi.mocked(loadProjectLogo).mockReset()
})

describe('public blog OG endpoint', () => {
	it('rejects malformed IDs before accessing storage', async () => {
		expect((await ogResponse('blog', 'not-an-id')).status).toBe(404)
		expect(publicOgBlog).not.toHaveBeenCalled()
	})
	it('renders blog metadata and rechecks visibility before serving cached bytes', async () => {
		const row = fixture()
		vi.mocked(publicOgBlog).mockResolvedValue(row)
		const first = await ogResponse('blog', row.id)
		expect(first.status).toBe(200)
		expect(first.headers.get('content-type')).toBe('image/png')
		expect(first.headers.get('cache-control')).toBe('no-store')
		expect((await ogResponse('blog', row.id)).status).toBe(200)
		expect(renderCard).toHaveBeenCalledTimes(1)
		expect(renderCard).toHaveBeenCalledWith(
			{
				kind: 'blog',
				title: row.title,
				fallback: row.slug,
				description: row.description,
				authorName: row.authorName,
				publishedAt: row.publishedAt,
				updatedAt: row.updatedAt,
				readTime: row.readTime,
			},
			expect.anything()
		)
		expect(loadProjectLogo).not.toHaveBeenCalled()
		expect(publicOgCategory).not.toHaveBeenCalled()
		expect(publicOgProject).not.toHaveBeenCalled()
		vi.mocked(publicOgBlog).mockResolvedValue(null)
		const hidden = await ogResponse('blog', row.id)
		expect(hidden.status).toBe(404)
		expect(hidden.headers.get('x-robots-tag')).toBe('noindex')
		expect(publicOgBlog).toHaveBeenCalledTimes(3)
	})
	it('refreshes rendering when stored article metadata changes', async () => {
		const row = fixture()
		vi.mocked(publicOgBlog)
			.mockResolvedValueOnce(row)
			.mockResolvedValueOnce({ ...row, title: 'An edited article' })
		await ogResponse('blog', row.id)
		await ogResponse('blog', row.id)
		expect(renderCard).toHaveBeenCalledTimes(2)
	})
	it('returns a retryable failure if image rendering fails', async () => {
		const row = fixture()
		vi.mocked(publicOgBlog).mockResolvedValue(row)
		vi.mocked(renderCard).mockRejectedValueOnce(new Error('Render failed'))
		const result = await ogResponse('blog', row.id)
		expect(result.status).toBe(503)
		expect(result.headers.get('retry-after')).toBe('30')
		expect(result.headers.get('cache-control')).toBe('no-store')
	})
})
