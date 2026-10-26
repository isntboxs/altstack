import { z } from 'zod'

import { AUDIT_ACTIONS, PROJECT_STATUS } from '@altstack/shared/constants'

const total = z.number().int().nonnegative()
const person = z.object({ id: z.uuid(), name: z.string() }).nullable()
const projectTarget = z.object({ id: z.uuid(), name: z.string() }).nullable()

export const adminOverviewSchema = z.object({
	observedAt: z.coerce.date(),
	counts: z.object({
		published: total,
		needsReview: total,
		openReports: total,
		pendingClaims: total,
		totalProjects: total,
		users: total,
	}),
	statuses: z.array(z.object({ status: z.enum(PROJECT_STATUS), count: total })),
	submissions: z.array(
		z.object({
			id: z.uuid(),
			name: z.string(),
			createdAt: z.coerce.date(),
			submitter: person,
		})
	),
	reports: z.array(
		z.object({
			id: z.uuid(),
			type: z.string(),
			createdAt: z.coerce.date(),
			project: projectTarget,
		})
	),
	claims: z.array(
		z.object({
			id: z.uuid(),
			projectId: z.uuid(),
			projectName: z.string(),
			name: z.string(),
			role: z.enum(['owner', 'maintainer']),
			requestedAt: z.coerce.date(),
		})
	),
})

export const adminActivityQuerySchema = z
	.object({
		page: z.coerce.number().int().min(1).max(100_000).default(1),
		limit: z.coerce.number().int().min(1).max(50).default(20),
		action: z.enum(AUDIT_ACTIONS).optional(),
		actorId: z.uuid().optional(),
		projectId: z.uuid().optional(),
		from: z.iso.date().optional(),
		to: z.iso.date().optional(),
	})
	.refine((q) => !q.from || !q.to || q.from <= q.to, {
		message: 'Start date must be before the end date.',
		path: ['to'],
	})

export const adminActivitySchema = z.object({
	events: z.array(
		z.object({
			id: z.uuid(),
			action: z.enum(AUDIT_ACTIONS),
			createdAt: z.coerce.date(),
			actor: person,
			project: projectTarget,
			targetUser: person,
			// An explicit allowlist. Evidence, ban/rejection reasons, email and raw
			// metadata belong to their private review/account flows, never this feed.
			details: z.object({
				fromStatus: z.enum(PROJECT_STATUS).nullable(),
				toStatus: z.enum(PROJECT_STATUS).nullable(),
				role: z.enum(['user', 'admin', 'owner', 'maintainer']).nullable(),
				previousRole: z
					.enum(['user', 'admin', 'owner', 'maintainer'])
					.nullable(),
			}),
		})
	),
	page: total,
	totalItems: total,
	totalPages: total,
})

export const adminOperationsSchema = z.object({
	observedAt: z.coerce.date(),
	github: z.object({
		total: total,
		fresh: total,
		stale: total,
		missing: total,
		latestFetchedAt: z.coerce.date().nullable(),
		oldestFetchedAt: z.coerce.date().nullable(),
		staleAfterHours: z.literal(48),
		failureTelemetry: z.literal('unavailable'),
	}),
	outbox: z.object({
		pending: total,
		failed: total,
		sent: total,
		cancelled: total,
		due: total,
		oldestPendingAt: z.coerce.date().nullable(),
		lastSentAt: z.coerce.date().nullable(),
	}),
})
