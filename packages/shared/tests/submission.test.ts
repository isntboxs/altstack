import { describe, expect, it } from 'vite-plus/test'

import {
	adminCreateProjectBodySchema,
	adminProjectSchema,
	adminUpdateProjectBodySchema,
	publishProjectSchema,
} from '@altstack/shared/schemas/admin-project'
import { projectSchema } from '@altstack/shared/schemas/common'
import {
	createSubmissionInputSchema,
	listSubmissionInputSchema,
} from '@altstack/shared/schemas/submission'

describe('submission input', () => {
	it('trims name, canonicalizes the repository and omits blank websites', () => {
		expect(
			createSubmissionInputSchema.parse({
				name: '  Altstack  ',
				repositoryUrl: 'https://www.github.com/IsntBoxs/AltStack.git/',
				websiteUrl: '  ',
			})
		).toEqual({
			name: 'Altstack',
			repositoryUrl: 'https://github.com/isntboxs/altstack',
			websiteUrl: undefined,
		})
	})
	it.each([
		'isntboxs/altstack',
		'https://github.com/isntboxs/altstack',
		'http://GITHUB.com/ISNTBOXS/ALTSTACK.GIT',
	])('accepts canonical variants %s', (repositoryUrl) => {
		expect(
			createSubmissionInputSchema.parse({ name: 'Altstack', repositoryUrl })
				.repositoryUrl
		).toBe('https://github.com/isntboxs/altstack')
	})
	it.each([
		{ name: ' ' },
		{ name: 'a' },
		{ name: 'a'.repeat(101) },
		{ name: undefined },
		{ repositoryUrl: undefined },
		{ repositoryUrl: 'invalid' },
		{ repositoryUrl: 'https://gitlab.com/owner/repo' },
		{ websiteUrl: 'ftp://example.com' },
		{ websiteUrl: 'javascript:alert(1)' },
		{ websiteUrl: 'example.com' },
	])('rejects invalid fields %j', (override) => {
		expect(
			createSubmissionInputSchema.safeParse({
				name: 'Altstack',
				repositoryUrl: 'isntboxs/altstack',
				...override,
			}).success
		).toBe(false)
	})
	it.each(['http://example.com', 'https://example.com'])(
		'accepts optional HTTP website %s',
		(websiteUrl) => {
			expect(
				createSubmissionInputSchema.parse({
					name: 'Altstack',
					repositoryUrl: 'isntboxs/altstack',
					websiteUrl,
				}).websiteUrl
			).toBe(websiteUrl)
		}
	)
	it('does not accept client control over status, slug or submitter', () => {
		expect(
			createSubmissionInputSchema.parse({
				name: 'Altstack',
				repositoryUrl: 'isntboxs/altstack',
				status: 'published',
				submitterId: 'attacker',
				slug: 'override',
			})
		).not.toHaveProperty('status')
	})
})

describe('owner submission queries', () => {
	it('defaults pagination and strips owner controls', () => {
		expect(
			listSubmissionInputSchema.parse({ query: { submitterId: 'override' } })
		).toEqual({ query: { page: 1, limit: 25 } })
	})
	it.each([
		{ page: 0 },
		{ page: 1.5 },
		{ limit: 0 },
		{ limit: 51 },
		{ q: 'a'.repeat(101) },
	])('rejects invalid paging and query bounds %j', (query) => {
		expect(listSubmissionInputSchema.safeParse({ query }).success).toBe(false)
	})
})

describe('draft and publish schemas', () => {
	it('accepts three-field admin drafts and empty nullable copy', () => {
		expect(
			adminCreateProjectBodySchema.parse({
				name: 'Altstack',
				slug: 'altstack',
				repositoryUrl: 'isntboxs/altstack',
				status: 'draft',
			})
		).toMatchObject({ categorySlugs: [], status: 'draft' })
		expect(
			adminUpdateProjectBodySchema.parse({
				tagline: '',
				description: ' ',
				logo: null,
				categorySlugs: [],
			})
		).toMatchObject({
			tagline: null,
			description: null,
			logo: null,
			categorySlugs: [],
		})
	})
	it('preserves default published admin creation', () => {
		expect(
			adminCreateProjectBodySchema.parse({
				name: 'Altstack',
				slug: 'altstack',
				repositoryUrl: 'isntboxs/altstack',
			}).status
		).toBe('published')
	})
	const complete = {
		name: 'Altstack',
		slug: 'altstack',
		repositoryUrl: 'isntboxs/altstack',
		tagline: 'A directory',
		description: 'A software directory',
		logo: 'projects/altstack/logo.png',
		categorySlugs: ['backend'],
	}
	it.each([
		'name',
		'slug',
		'repositoryUrl',
		'tagline',
		'description',
		'logo',
		'categorySlugs',
	] as const)('requires %s to publish', (key) => {
		expect(
			publishProjectSchema.safeParse({
				...complete,
				[key]: key === 'categorySlugs' ? [] : null,
			}).success
		).toBe(false)
	})
	it('allows complete records and at most three distinct categories', () => {
		expect(publishProjectSchema.safeParse(complete).success).toBe(true)
		expect(
			publishProjectSchema.safeParse({
				...complete,
				categorySlugs: ['one', 'two', 'three', 'four'],
			}).success
		).toBe(false)
	})
	it('keeps incomplete admin responses separate from complete public responses', () => {
		const draft = {
			id: '550e8400-e29b-41d4-a716-446655440000',
			...complete,
			repositoryUrl: 'https://github.com/isntboxs/altstack',
			tagline: null,
			description: null,
			logo: null,
			screenshot: null,
			websiteUrl: null,
			content: null,
			categories: [],
			status: 'draft',
			createdAt: new Date(),
			updatedAt: new Date(),
			submitterId: null,
			submitter: null,
			rejectionReason: null,
		}
		expect(adminProjectSchema.safeParse(draft).success).toBe(true)
		expect(projectSchema.safeParse(draft).success).toBe(false)
	})
})
