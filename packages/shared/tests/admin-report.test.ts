import { describe, expect, it } from 'vite-plus/test'

import {
	adminListReportsQuerySchema,
	adminModerateReportInputSchema,
} from '@altstack/shared/schemas/admin-report'

describe('admin report validation', () => {
	it('defaults to bounded Open pages and accepts HTTP limit coercion', () => {
		expect(adminListReportsQuerySchema.parse({})).toEqual({
			status: 'open',
			limit: 12,
		})
		expect(
			adminListReportsQuerySchema.parse({ status: 'all', limit: '50' })
		).toEqual({ status: 'all', limit: 50 })
	})
	it.each([
		{ limit: 0 },
		{ limit: 51 },
		{ limit: 1.5 },
		{ status: 'unknown' },
		{ cursor: '' },
	])('rejects invalid query %j', (query) => {
		expect(adminListReportsQuerySchema.safeParse(query).success).toBe(false)
	})
	it('only accepts resolved/dismissed decisions and rejects extra private fields', () => {
		const params = { id: '550e8400-e29b-41d4-a716-446655440000' }
		for (const status of ['resolved', 'dismissed']) {
			expect(
				adminModerateReportInputSchema.safeParse({ params, body: { status } })
					.success
			).toBe(true)
		}
		for (const body of [
			{ status: 'open' },
			{},
			{ status: 'resolved', email: 'spoof@example.test' },
		]) {
			expect(
				adminModerateReportInputSchema.safeParse({ params, body }).success
			).toBe(false)
		}
	})
})
