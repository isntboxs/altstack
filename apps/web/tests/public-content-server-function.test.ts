// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { ZodType } from 'zod'

import { publicProjectContent } from '@altstack/api/queries/project-mentions'

import { emptyPublicContent } from '#/features/public-content/model'
import type { PreparedPublicContent } from '#/features/public-content/model'
import { prepareContent } from '#/features/public-content/prepare.server'
import { preparePublicContent } from '#/features/public-content/server-function'

type Input = { slug: string }

const { registerValidator } = vi.hoisted(() => {
	return { registerValidator: vi.fn<(schema: ZodType<Input>) => void>() }
})

vi.mock('@altstack/api/queries/project-mentions', () => {
	return { publicProjectContent: vi.fn() }
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
	vi.mocked(publicProjectContent).mockReset().mockResolvedValue(undefined)
	vi.mocked(prepareContent).mockReset().mockResolvedValue(emptyPublicContent())
})

describe('public content server input', () => {
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
