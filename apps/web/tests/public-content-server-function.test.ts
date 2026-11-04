// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ZodType } from 'zod'

import { publicBlogContent } from '@altstack/api/queries/blog'
import { publicProjectContent } from '@altstack/api/queries/project-mentions'

import { emptyPublicContent } from '#/features/public-content/model'
import type { PreparedPublicContent } from '#/features/public-content/model'
import { prepareContent } from '#/features/public-content/prepare.server'
import {
	preparePublicContent,
	preparePublicBlogContent,
	preparePublicPageContent,
} from '#/features/public-content/server-function'

type Input = { slug: string }

const { registerValidator } = vi.hoisted(() => {
	return { registerValidator: vi.fn<(schema: ZodType<Input>) => void>() }
})
const { getCollection, getAbout } = vi.hoisted(() => {
	return { getCollection: vi.fn(), getAbout: vi.fn() }
})
vi.mock('#/utils/orpc', () => {
	return {
		client: {
			collection: { getBySlug: getCollection },
			about: { get: getAbout },
		},
	}
})

vi.mock('@altstack/api/queries/project-mentions', () => {
	return { publicProjectContent: vi.fn() }
})
vi.mock('@altstack/db', () => {
	return { db: {} }
})
vi.mock('@altstack/api/queries/blog', () => {
	return { publicBlogContent: vi.fn() }
})
vi.mock('#/features/public-content/prepare.server', () => {
	return { prepareContent: vi.fn() }
})
vi.mock('@tanstack/react-start', () => {
	return {
		createServerFn: () => {
			return {
				validator: (schema: ZodType<Input>) => {
					registerValidator(schema)
					return {
						handler:
							(
								handler: (options: {
									data: Input
								}) => Promise<PreparedPublicContent>
							) =>
							({ data }: { data: Input }) =>
								handler({ data: schema.parse(data) }),
					}
				},
			}
		},
	}
})

beforeEach(() => {
	getCollection.mockReset().mockResolvedValue({ content: '# Collection' })
	getAbout.mockReset().mockResolvedValue({ content: '# About' })
	vi.mocked(publicBlogContent).mockReset().mockResolvedValue(undefined)
	vi.mocked(publicProjectContent).mockReset().mockResolvedValue(undefined)
	vi.mocked(prepareContent).mockReset().mockResolvedValue(emptyPublicContent())
})

describe('public content server input', () => {
	it('prepares stored public collection and About content without accepting caller-supplied Markdown', async () => {
		await preparePublicPageContent({
			data: { kind: 'collection', slug: 'frontend' },
		})
		expect(getCollection).toHaveBeenCalledExactlyOnceWith({
			params: { slug: 'frontend' },
		})
		expect(prepareContent).toHaveBeenCalledWith({
			slug: 'collections/frontend',
			content: '# Collection',
		})
		await preparePublicPageContent({ data: { kind: 'about', slug: 'about' } })
		expect(getAbout).toHaveBeenCalledExactlyOnceWith({})
		expect(prepareContent).toHaveBeenCalledWith({
			slug: 'about',
			content: '# About',
		})
		const schema = registerValidator.mock.calls[2][0]
		expect(
			schema.safeParse({
				kind: 'collection',
				slug: 'frontend',
				content: '# Arbitrary',
			}).success
		).toBe(false)
		expect(
			schema.safeParse({ kind: 'collection', slug: '../draft' }).success
		).toBe(false)
		expect(schema.safeParse({ kind: 'about', slug: 'anything' }).success).toBe(
			false
		)
		getCollection.mockRejectedValueOnce(new Error('NOT_FOUND'))
		await expect(
			preparePublicPageContent({ data: { kind: 'collection', slug: 'hidden' } })
		).rejects.toThrow('NOT_FOUND')
	})
	const validator = registerValidator.mock.calls[0][0]

	it('accepts only the slug and rejects caller-provided Markdown', () => {
		const input = { slug: 'x'.repeat(100) }
		expect(validator.parse(input)).toEqual(input)
		for (const content of [
			'',
			'# Arbitrary Markdown',
			'x'.repeat(100 * 1024),
		]) {
			expect(validator.safeParse({ ...input, content }).success).toBe(false)
		}
		for (const slug of ['', 'x'.repeat(101)]) {
			expect(validator.safeParse({ ...input, slug }).success).toBe(false)
		}
	})

	it('prepares only the published project content loaded from storage', async () => {
		const content = '\tstored code  \n\n'
		const prepared = {
			collectionsBySlug: {},
			codeBlocks: {},
			projectsBySlug: {
				atlas: {
					slug: 'atlas',
					name: 'Atlas',
					logo: null,
					tagline: null,
					stars: 0,
					forks: 0,
				},
			},
		}
		vi.mocked(publicProjectContent).mockResolvedValue({ content })
		vi.mocked(prepareContent).mockResolvedValue(prepared)
		expect(await preparePublicContent({ data: { slug: 'project' } })).toEqual(
			prepared
		)
		expect(publicProjectContent).toHaveBeenCalledExactlyOnceWith('project')
		expect(prepareContent).toHaveBeenCalledExactlyOnceWith({
			slug: 'project',
			content,
		})
	})

	it.each([undefined, { content: null }, { content: '' }])(
		'returns empty content without preparation for %j',
		async (row) => {
			vi.mocked(publicProjectContent).mockResolvedValue(row)
			expect(await preparePublicContent({ data: { slug: 'project' } })).toEqual(
				emptyPublicContent()
			)
			expect(prepareContent).not.toHaveBeenCalled()
		}
	)

	it('does not turn a storage failure into a missing project', async () => {
		const error = new Error('Database unavailable')
		vi.mocked(publicProjectContent).mockRejectedValue(error)
		await expect(
			preparePublicContent({ data: { slug: 'project' } })
		).rejects.toBe(error)
		expect(prepareContent).not.toHaveBeenCalled()
	})
})

describe('public blog preparation', () => {
	it('accepts only a blog slug and rejects caller-provided content', () => {
		const validator = registerValidator.mock.calls[1][0]
		expect(validator.safeParse({ slug: 'a'.repeat(160) }).success).toBe(true)
		for (const input of [
			{ slug: '' },
			{ slug: 'not/a-slug' },
			{ slug: 'post', content: '# Caller content' },
		]) {
			expect(validator.safeParse(input).success).toBe(false)
		}
	})
	it('does not prepare an unavailable or draft blog', async () => {
		expect(
			await preparePublicBlogContent({ data: { slug: 'private-draft' } })
		).toEqual(emptyPublicContent())
		expect(prepareContent).not.toHaveBeenCalled()
	})
	it('runs stored published blog content through the shared highlighting and mention preparer', async () => {
		vi.mocked(publicBlogContent).mockResolvedValue({
			content: '## Intro\n\n```js\nconst x = 1\n```',
		})
		await preparePublicBlogContent({ data: { slug: 'tech-article' } })
		expect(prepareContent).toHaveBeenCalledExactlyOnceWith({
			slug: 'blogs/tech-article',
			content: '## Intro\n\n```js\nconst x = 1\n```',
		})
	})
})
