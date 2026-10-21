import { ratelimit } from '@orpc/ratelimit'
import { and, eq } from 'drizzle-orm'
import { createHash } from 'node:crypto'

import { publicProcedure } from '@altstack/api/procedures'
import {
	guestReportRateLimiter,
	reportRateLimiter,
} from '@altstack/api/report-rate-limit'

import { project, projectReport } from '@altstack/db/schemas'

import { reportEmailSchema } from '@altstack/shared/schemas/report'

export const reportRouter = {
	create: publicProcedure.report.create
		.use(async ({ context, next, errors }, input) => {
			const contact = reportEmailSchema.safeParse(
				context.auth ? context.auth.user.email : input.body.email
			)
			if (!contact.success) {
				throw errors.BAD_REQUEST({
					message: 'A valid contact email is required.',
				})
			}
			const userId = context.auth?.user.id ?? null
			return next({
				context: {
					reporter: { userId, email: contact.data },
					reportLimitKey: userId
						? `user:${userId}`
						: `email:${createHash('sha256').update(contact.data.toLowerCase()).digest('hex')}`,
				},
			})
		})
		.use(
			// oxlint-disable-next-line typescript/no-unsafe-argument
			ratelimit({
				limiter: reportRateLimiter,
				key: ({ context }) => context.reportLimitKey,
			})
		)
		.use(async (options, input, output) => {
			if (options.context.reporter.userId) return options.next()
			return ratelimit({ limiter: guestReportRateLimiter, key: 'anonymous' })(
				options,
				input,
				output
			)
		})
		.handler(async ({ context: { db, reporter }, input, errors }) => {
			try {
				await db.transaction(async (tx) => {
					// Lock visibility through commit so unpublish/delete cannot race intake.
					const [target] = await tx
						.select({ id: project.id })
						.from(project)
						.where(
							and(
								eq(project.id, input.params.id),
								eq(project.status, 'published')
							)
						)
						.limit(1)
						.for('share')
					if (!target) throw errors.NOT_FOUND()
					await tx.insert(projectReport).values({
						projectId: target.id,
						...reporter,
						type: input.body.type,
						message: input.body.message,
					})
				})
			} catch (error) {
				if (
					error instanceof Error &&
					'code' in error &&
					error.code === 'NOT_FOUND'
				) {
					throw error
				}
				// Do not expose SQL details or reporter contact data on write failure.
				throw errors.INTERNAL_SERVER_ERROR()
			}
			return { received: true }
		}),
}
