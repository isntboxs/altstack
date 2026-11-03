import { defaultParseSearch } from '@tanstack/react-router'
import { describe, expect, it } from 'vite-plus/test'

import { searchProjectsQuerySchema } from '@altstack/shared/schemas/project'

import { homeProjectSearchSchema } from '#/features/project/search'
import { stringifyProjectSearch } from '#/features/project/search-serialization'
import { cataloguePolicy } from '#/features/seo/meta'

describe('home multi-select filter URLs', () => {
	it('normalizes multiple values, preserves single values and deduplicates', () => {
		expect(
			searchProjectsQuerySchema.parse({
				category: ' accounting-software,ai-agents,accounting-software ',
				license: 'MIT,agpl-3.0,apache-2.0,mit',
			})
		).toMatchObject({
			category: 'accounting-software,ai-agents',
			license: 'mit,agpl-3.0,apache-2.0',
		})
		expect(
			searchProjectsQuerySchema.parse({ category: 'ai-agents', license: 'mit' })
		).toMatchObject({ category: 'ai-agents', license: 'mit' })
	})
	it('validates each slug and bounds list sizes', () => {
		for (const license of [
			'mit,,apache-2.0',
			'mit,../secret',
			'',
			Array.from({ length: 101 }, (_, i) => `license-${i}`).join(','),
		]) {
			expect(searchProjectsQuerySchema.safeParse({ license }).success).toBe(
				false
			)
		}
		expect(
			searchProjectsQuerySchema.safeParse({
				category: `${'a'.repeat(101)},tools`,
			}).success
		).toBe(false)
		expect(
			homeProjectSearchSchema.parse({
				category: 'tools,,',
				license: 'bad/license',
				q: 'test',
			})
		).toMatchObject({ category: undefined, license: undefined, q: 'test' })
	})
	it('writes literal commas only for filter values and round trips reserved characters', () => {
		const search = {
			category: 'tools,editors',
			license: 'mit,apache-2.0',
			q: 'hello, world & category=a,b',
			page: 2,
		}
		const encoded = stringifyProjectSearch(search)
		expect(encoded).toContain('category=tools,editors&license=mit,apache-2.0')
		expect(encoded).toContain('q=hello%2C')
		expect(defaultParseSearch(encoded)).toEqual(search)
	})
	it('marks home license-only and combined filters as noindex', () => {
		for (const search of [
			{ license: 'mit' },
			{ category: 'tools,editors', license: 'mit,apache-2.0' },
		]) {
			expect(cataloguePolicy('/', search, 1).noindex).toBe(true)
		}
	})
})
