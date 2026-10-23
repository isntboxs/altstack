import { describe, expect, it } from 'vite-plus/test'

import {
	githubLicenseMetadata,
	normalizeGithubLicense,
} from '@altstack/shared/lib/github-license'
import { licenseSlugSchema } from '@altstack/shared/schemas/license'
import {
	searchProjectsQuerySchema,
	searchSortSchema,
} from '@altstack/shared/schemas/project'

describe('GitHub license normalization', () => {
	it.each([
		'MIT',
		'Apache-2.0',
		'AGPL-3.0-only',
		'BSD-3-Clause',
		'0BSD',
		'GPL-2.0+',
	])('preserves reported SPDX identity without a whitelist: %s', (id) => {
		const result = normalizeGithubLicense({
			key: id.toLowerCase(),
			name: `${id} License`,
			spdx_id: id,
		})
		expect(result).toMatchObject({
			licenseSpdxId: id,
			licenseSlug: id.toLowerCase(),
			licenseName: `${id} License`,
		})
		expect(result.licenseUrl).toBe(
			`https://spdx.org/licenses/${encodeURIComponent(id)}.html`
		)
		expect(licenseSlugSchema.parse(result.licenseSlug)).toBe(result.licenseSlug)
	})
	it.each([
		null,
		undefined,
		{ key: 'other', name: 'Other', spdx_id: 'NOASSERTION' },
		{ key: 'custom', name: 'My custom terms', spdx_id: null },
		{ key: 'custom', name: 'Custom', spdx_id: 'LicenseRef-Private' },
		{ key: 'custom', name: 'Nonstandard', spdx_id: 'Totally-Custom' },
	])(
		'keeps undetected/custom licenses unknown with no invented link: %j',
		(payload) => {
			const result = normalizeGithubLicense(payload)
			expect(result.licenseSlug).toBeNull()
			expect(result.licenseUrl).toBeNull()
			expect(result.licenseName).toBe(payload?.name ?? null)
		}
	)
	it('uses a human license document, never an API endpoint or unsafe URL', () => {
		const base = { key: 'mit', name: 'MIT License', spdx_id: 'MIT' }
		expect(
			normalizeGithubLicense({
				...base,
				html_url: 'https://choosealicense.com/licenses/mit/',
			}).licenseUrl
		).toBe('https://choosealicense.com/licenses/mit/')
		for (const html_url of [
			'https://api.github.com/licenses/mit',
			'javascript:alert(1)',
			'https://user:password@example.com',
		]) {
			expect(normalizeGithubLicense({ ...base, html_url }).licenseUrl).toBe(
				'https://spdx.org/licenses/MIT.html'
			)
		}
	})
	it('only records archival when GitHub reports it', () => {
		expect(githubLicenseMetadata({}).archived).toBeNull()
		expect(githubLicenseMetadata({ archived: false }).archived).toBe(false)
		expect(githubLicenseMetadata({ archived: true }).archived).toBe(true)
	})
})

it('validates all ten sorts and preserves legacy query values', () => {
	expect(searchSortSchema.options).toHaveLength(10)
	for (const sort of searchSortSchema.options) {
		expect(
			searchProjectsQuerySchema.parse({ sort, license: 'Apache-2.0' })
		).toMatchObject({ sort, license: 'apache-2.0', page: 1 })
	}
	expect(
		searchProjectsQuerySchema.safeParse({ sort: 'sql injection' }).success
	).toBe(false)
	expect(
		searchProjectsQuerySchema.safeParse({ license: '../../drafts' }).success
	).toBe(false)
})
