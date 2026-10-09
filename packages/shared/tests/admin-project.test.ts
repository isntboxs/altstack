import { describe, expect, it } from 'vite-plus/test'

import {
	adminDeleteProjectInputSchema,
	adminListProjectInputSchema,
	adminProjectReviewHistoryInputSchema,
	adminUpdateProjectInputSchema,
} from '@altstack/shared/schemas/admin-project'
import {
	projectLogoKeySchema,
	projectScreenshotKeySchema,
} from '@altstack/shared/schemas/upload'

const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440000'
const TMP_LOGO = 'tmp/logos/my-logo-1759380000000.png'
const TMP_SCREENSHOT = 'tmp/screenshots/landing-1759380000000.webp'
const FINAL_LOGO = `projects/my-project/logo-${PROJECT_ID}.png`
const FINAL_SCREENSHOT = `projects/my-project/screenshot-${PROJECT_ID}.jpg`

describe('adminListProjectInputSchema', () => {
	it('preserves pagination and sorting defaults', () => {
		expect(adminListProjectInputSchema.parse({ query: {} })).toEqual({
			query: { page: 1, limit: 12, sort: 'createdAt', order: 'desc' },
		})
	})

	it.each([
		[true, true],
		[false, false],
		['true', true],
		['false', false],
		[undefined, undefined],
	])('parses needsReview %j as %j', (input, expected) => {
		expect(
			adminListProjectInputSchema.parse({ query: { needsReview: input } }).query
				.needsReview
		).toBe(expected)
	})

	it.each(['', 'yes', '0', '1', 'False', 0, 1, null, [], {}])(
		'rejects ambiguous needsReview input %j',
		(needsReview) => {
			expect(
				adminListProjectInputSchema.safeParse({ query: { needsReview } })
					.success
			).toBe(false)
		}
	)

	it.each([
		{ sort: 'repositoryUrl' },
		{ sort: 'name; DROP TABLE projects' },
		{ order: 'invalid' },
	])('rejects unsupported sorting input %j', (input) => {
		expect(
			adminListProjectInputSchema.safeParse({ query: input }).success
		).toBe(false)
	})
})

describe('adminProjectReviewHistoryInputSchema', () => {
	it('defaults pagination and coerces HTTP numbers up to the limit', () => {
		expect(
			adminProjectReviewHistoryInputSchema.parse({
				params: { id: PROJECT_ID },
				query: {},
			})
		).toEqual({ params: { id: PROJECT_ID }, query: { page: 1, limit: 20 } })
		expect(
			adminProjectReviewHistoryInputSchema.parse({
				params: { id: PROJECT_ID },
				query: { page: '2', limit: '50' },
			}).query
		).toEqual({ page: 2, limit: 50 })
	})
	it.each([
		{ page: 0 },
		{ page: -1 },
		{ page: 'NaN' },
		{ page: 1.5 },
		{ limit: 0 },
		{ limit: 51 },
		{ limit: 2.5 },
		{ limit: 'invalid' },
	])('rejects invalid pagination %j', (query) => {
		expect(
			adminProjectReviewHistoryInputSchema.safeParse({
				params: { id: PROJECT_ID },
				query,
			}).success
		).toBe(false)
	})
	it('requires a project UUID', () => {
		expect(
			adminProjectReviewHistoryInputSchema.safeParse({
				params: { id: 'bad' },
				query: {},
			}).success
		).toBe(false)
	})
})

describe('project final key schemas', () => {
	it('accepts keys under projects/{slug}/', () => {
		expect(projectLogoKeySchema.safeParse(FINAL_LOGO).success).toBe(true)
		expect(projectScreenshotKeySchema.safeParse(FINAL_SCREENSHOT).success).toBe(
			true
		)
	})

	it('rejects tmp keys and malformed finals', () => {
		expect(projectLogoKeySchema.safeParse(TMP_LOGO).success).toBe(false)
		expect(projectScreenshotKeySchema.safeParse(TMP_SCREENSHOT).success).toBe(
			false
		)
		expect(
			projectLogoKeySchema.safeParse('projects/my-project/logo-123.png').success
		).toBe(false)
	})
})

describe('adminUpdateProjectInputSchema', () => {
	it('accepts id alone (no-op patch)', () => {
		const parsed = adminUpdateProjectInputSchema.parse({
			params: { id: PROJECT_ID },
		})
		expect(parsed.params.id).toBe(PROJECT_ID)
		expect(parsed.body?.logo).toBeUndefined()
	})

	it('accepts tmp keys for replacement', () => {
		const parsed = adminUpdateProjectInputSchema.parse({
			params: { id: PROJECT_ID },
			body: { logo: TMP_LOGO, screenshot: TMP_SCREENSHOT },
		})
		expect(parsed.body?.logo).toBe(TMP_LOGO)
		expect(parsed.body?.screenshot).toBe(TMP_SCREENSHOT)
	})

	it('accepts screenshot: null for removal', () => {
		const parsed = adminUpdateProjectInputSchema.parse({
			params: { id: PROJECT_ID },
			body: { screenshot: null },
		})
		expect(parsed.body?.screenshot).toBeNull()
	})

	it('rejects final keys (only tmp keys may be submitted)', () => {
		expect(
			adminUpdateProjectInputSchema.safeParse({
				params: { id: PROJECT_ID },
				body: { logo: FINAL_LOGO },
			}).success
		).toBe(false)
		expect(
			adminUpdateProjectInputSchema.safeParse({
				params: { id: PROJECT_ID },
				body: { screenshot: FINAL_SCREENSHOT },
			}).success
		).toBe(false)
	})

	it('rejects invalid id and allows empty draft categorySlugs', () => {
		expect(
			adminUpdateProjectInputSchema.safeParse({ params: { id: 'not-a-uuid' } })
				.success
		).toBe(false)
		expect(
			adminUpdateProjectInputSchema.safeParse({
				params: { id: PROJECT_ID },
				body: { categorySlugs: [] },
			}).success
		).toBe(true)
	})
})

describe('adminDeleteProjectInputSchema', () => {
	it('accepts a uuid and rejects anything else', () => {
		expect(
			adminDeleteProjectInputSchema.parse({ params: { id: PROJECT_ID } })
		).toEqual({ params: { id: PROJECT_ID } })
		expect(
			adminDeleteProjectInputSchema.safeParse({ params: { id: 'not-a-uuid' } })
				.success
		).toBe(false)
		expect(
			adminDeleteProjectInputSchema.safeParse({ params: {} }).success
		).toBe(false)
	})
})
