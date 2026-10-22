import { z } from 'zod'

export const reportTypes = [
	{ value: 'broken_link', label: 'Broken link' },
	{ value: 'wrong_category', label: 'Wrong category' },
	{ value: 'outdated', label: 'Outdated' },
	{ value: 'other', label: 'Other' },
] as const

export const reportEmailSchema = z.string().trim().max(254).pipe(z.email())
export const reportTypeSchema = z.enum([
	'broken_link',
	'wrong_category',
	'outdated',
	'other',
])
export const reportMessageMaxLength = 2000
export const reportStatuses = [
	{ value: 'open', label: 'Open' },
	{ value: 'resolved', label: 'Resolved' },
	{ value: 'dismissed', label: 'Dismissed' },
] as const
export const reportStatusSchema = z.enum(['open', 'resolved', 'dismissed'])

export const reportBodySchema = z
	.object({
		type: reportTypeSchema,
		message: z
			.string()
			.trim()
			.max(reportMessageMaxLength)
			.optional()
			.default(''),
		// Optional at the wire boundary: authenticated identity comes from the server.
		email: reportEmailSchema.optional(),
	})
	.strict()
	.superRefine((value, context) => {
		if (value.type === 'other' && !value.message) {
			context.addIssue({
				code: 'custom',
				path: ['message'],
				message: 'Please describe the issue.',
			})
		}
	})

export const guestReportBodySchema = reportBodySchema.safeExtend({
	email: reportEmailSchema,
})
export const createReportInputSchema = z.object({
	params: z.object({ id: z.uuid() }).strict(),
	body: reportBodySchema,
})
export const createReportOutputSchema = z.object({ received: z.literal(true) })
