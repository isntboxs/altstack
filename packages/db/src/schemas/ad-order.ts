import type { ReviewEmailPayload } from './review-notification'
import { sql } from 'drizzle-orm'
import {
	check,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	uniqueIndex,
} from 'drizzle-orm/pg-core'

import type {
	AdCreative,
	AdPlan,
	AdOrderView,
} from '@altstack/shared/schemas/ad-billing'

import { adCampaign } from './ad'
import { user } from './auth'

export const adOrder = pgTable(
	'ad_orders',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		plan: text('plan').$type<AdPlan>().notNull(),
		amount: integer('amount').notNull(),
		currency: text('currency').$type<'usd'>().notNull().default('usd'),
		status: text('status')
			.$type<AdOrderView['status']>()
			.notNull()
			.default('pending_payment'),
		email: text('email').notNull(),
		accessNonce: uuid('access_nonce').defaultRandom().notNull(),
		material: jsonb('material').$type<AdCreative>(),
		feedback: text('feedback'),
		campaignId: uuid('campaign_id')
			.references(() => adCampaign.id, { onDelete: 'restrict' })
			.unique(),
		paidAt: timestamp('paid_at', { withTimezone: true }),
		startsAt: timestamp('starts_at', { withTimezone: true }),
		paidThrough: timestamp('paid_through', { withTimezone: true }),
		renewalRequestedAt: timestamp('renewal_requested_at', {
			withTimezone: true,
		}),
		termsVersion: text('terms_version')
			.notNull()
			.default('2026-11-manual-ads-v1'),
		version: integer('version').notNull().default(1),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index('ad_orders_email_idx').on(t.email),
		index('ad_orders_review_idx').on(t.status, t.createdAt),
		check('ad_orders_plan_check', sql`${t.plan} in ('core','plus','priority')`),
		check(
			'ad_orders_status_check',
			sql`${t.status} in ('pending_payment','awaiting_materials','in_review','changes_requested','approved','rejected')`
		),
		check(
			'ad_orders_amount_check',
			sql`${t.amount} > 0 AND ${t.currency} = 'usd'`
		),
		check('ad_orders_version_check', sql`${t.version} > 0`),
		check(
			'ad_orders_dates_check',
			sql`(${t.startsAt} IS NULL AND ${t.paidThrough} IS NULL) OR (${t.startsAt} IS NOT NULL AND ${t.paidThrough} IS NOT NULL AND ${t.paidThrough} > ${t.startsAt})`
		),
	]
)
export const adPayment = pgTable(
	'ad_payments',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		orderId: uuid('order_id')
			.notNull()
			.references(() => adOrder.id, { onDelete: 'restrict' }),
		kind: text('kind').$type<'initial' | 'renewal'>().notNull(),
		amount: integer('amount').notNull(),
		reference: text('reference').notNull(),
		confirmedBy: uuid('confirmed_by').references(() => user.id, {
			onDelete: 'set null',
		}),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [
		index('ad_payments_order_idx').on(t.orderId),
		uniqueIndex('ad_payments_reference_unique').on(sql`lower(${t.reference})`),
		check('ad_payments_kind_check', sql`${t.kind} in ('initial','renewal')`),
		check('ad_payments_amount_check', sql`${t.amount} > 0`),
	]
)
export const adUpload = pgTable('ad_uploads', {
	key: text('key').primaryKey(),
	orderId: uuid('order_id')
		.notNull()
		.references(() => adOrder.id, { onDelete: 'cascade' }),
	kind: text('kind').$type<'logo' | 'banner'>().notNull(),
	createdAt: timestamp('created_at', { withTimezone: true })
		.notNull()
		.defaultNow(),
})
export const adNotification = pgTable(
	'ad_notifications',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		orderId: uuid('order_id')
			.notNull()
			.references(() => adOrder.id, { onDelete: 'cascade' }),
		eventKey: text('event_key').notNull().unique(),
		kind: text('kind')
			.$type<
				| 'access'
				| 'ordered'
				| 'paid'
				| 'submitted'
				| 'approved'
				| 'revision'
				| 'rejected'
				| 'renewal_requested'
				| 'renewed'
			>()
			.notNull(),
		audience: text('audience')
			.$type<'advertiser' | 'admin'>()
			.notNull()
			.default('advertiser'),
		payload: jsonb('payload').$type<
			ReviewEmailPayload & { replyTo?: string }
		>(),
		reason: text('reason'),
		status: text('status')
			.$type<'pending' | 'sent' | 'failed'>()
			.notNull()
			.default('pending'),
		attempts: integer('attempts').notNull().default(0),
		leaseUntil: timestamp('lease_until', { withTimezone: true }),
		leaseToken: uuid('lease_token'),
		nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
		sentAt: timestamp('sent_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(t) => [index('ad_notifications_due_idx').on(t.status, t.nextAttemptAt)]
)
