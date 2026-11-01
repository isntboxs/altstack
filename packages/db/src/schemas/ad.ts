import { sql } from 'drizzle-orm'
import {
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from 'drizzle-orm/pg-core'

export const adCampaign = pgTable(
	'ad_campaigns',
	{
		id: uuid('id')
			.default(sql`pg_catalog.gen_random_uuid()`)
			.primaryKey(),
		name: text('name').notNull(),
		description: text('description').notNull(),
		websiteUrl: text('website_url').notNull(),
		logo: text('logo').notNull(),
		banner: text('banner').notNull(),
		ctaText: text('cta_text').notNull(),
		buttonColor: text('button_color').notNull(),
		tier: text('tier').$type<'tier1' | 'tier2' | 'tier3'>().notNull(),
		status: text('status')
			.$type<'draft' | 'active' | 'inactive'>()
			.notNull()
			.default('draft'),
		startMonth: text('start_month').notNull(),
		months: integer('months').notNull(),
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
		endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
		version: integer('version').notNull().default(1),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at').defaultNow().notNull(),
	},
	(t) => [
		index('ad_campaigns_eligibility_idx').on(t.status, t.startsAt, t.endsAt),
		check(
			'ad_campaigns_tier_check',
			sql`${t.tier} IN ('tier1','tier2','tier3')`
		),
		check(
			'ad_campaigns_status_check',
			sql`${t.status} IN ('draft','active','inactive')`
		),
		check(
			'ad_campaigns_period_check',
			sql`${t.endsAt} > ${t.startsAt} AND ${t.months} BETWEEN 1 AND 24`
		),
		check('ad_campaigns_version_check', sql`${t.version} > 0`),
		check(
			'ad_campaigns_color_check',
			sql`${t.buttonColor} ~ '^#[0-9a-fA-F]{6}$'`
		),
	]
)
