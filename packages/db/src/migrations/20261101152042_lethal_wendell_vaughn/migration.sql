CREATE TABLE "ad_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
	"name" text NOT NULL,
	"description" text NOT NULL,
	"website_url" text NOT NULL,
	"logo" text NOT NULL,
	"banner" text NOT NULL,
	"cta_text" text NOT NULL,
	"button_color" text NOT NULL,
	"tier" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"start_month" text NOT NULL,
	"months" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ad_campaigns_tier_check" CHECK ("tier" IN ('tier1','tier2','tier3')),
	CONSTRAINT "ad_campaigns_status_check" CHECK ("status" IN ('draft','active','inactive')),
	CONSTRAINT "ad_campaigns_period_check" CHECK ("ends_at" > "starts_at" AND "months" BETWEEN 1 AND 24),
	CONSTRAINT "ad_campaigns_version_check" CHECK ("version" > 0),
	CONSTRAINT "ad_campaigns_color_check" CHECK ("button_color" ~ '^#[0-9a-fA-F]{6}$')
);
--> statement-breakpoint
CREATE INDEX "ad_campaigns_eligibility_idx" ON "ad_campaigns" ("status","starts_at","ends_at");