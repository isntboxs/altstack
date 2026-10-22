import { describe, expect, it } from 'vite-plus/test'

import {
	createReportInputSchema,
	guestReportBodySchema,
	reportBodySchema,
	reportTypes,
} from '@altstack/shared/schemas/report'

describe('report validation', () => {
	it.each(reportTypes.slice(0, 3))(
		'allows an optional trimmed message for $label',
		({ value }) => {
			expect(
				guestReportBodySchema.parse({
					email: ' guest@example.test ',
					type: value,
				})
			).toMatchObject({ email: 'guest@example.test', message: '' })
			expect(
				reportBodySchema.parse({ type: value, message: '  details  ' }).message
			).toBe('details')
		}
	)
	it('requires a nonblank message only for Other', () => {
		for (const message of [undefined, '', ' \n\t ']) {
			expect(
				reportBodySchema.safeParse({ type: 'other', message }).success
			).toBe(false)
		}
		expect(
			reportBodySchema.parse({
				type: 'other',
				message: '  Please correct this  ',
			}).message
		).toBe('Please correct this')
	})
	it('requires a valid bounded guest email and bounds all payloads', () => {
		for (const email of [
			undefined,
			'',
			'invalid',
			`${'a'.repeat(250)}@test.com`,
		]) {
			expect(
				guestReportBodySchema.safeParse({ type: 'outdated', email }).success
			).toBe(false)
		}
		for (const body of [
			{ type: 'invalid' },
			{ type: 'outdated', message: 'x'.repeat(2001) },
			{ type: 'outdated', userId: 'spoof' },
		]) {
			expect(reportBodySchema.safeParse(body).success).toBe(false)
		}
		expect(
			createReportInputSchema.safeParse({
				params: { id: 'missing' },
				body: { type: 'outdated' },
			}).success
		).toBe(false)
	})
})
