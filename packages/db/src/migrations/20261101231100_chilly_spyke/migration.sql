CREATE TABLE "ad_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"event_key" text NOT NULL UNIQUE,
	"kind" text NOT NULL,
	"audience" text DEFAULT 'advertiser' NOT NULL,
	"payload" jsonb,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_until" timestamp with time zone,
	"lease_token" uuid,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"plan" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"email" text NOT NULL,
	"access_nonce" uuid DEFAULT gen_random_uuid() NOT NULL,
	"material" jsonb,
	"feedback" text,
	"campaign_id" uuid UNIQUE,
	"paid_at" timestamp with time zone,
	"starts_at" timestamp with time zone,
	"paid_through" timestamp with time zone,
	"renewal_requested_at" timestamp with time zone,
	"terms_version" text DEFAULT '2026-11-manual-ads-v1' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ad_orders_plan_check" CHECK ("plan" in ('core','plus','priority')),
	CONSTRAINT "ad_orders_status_check" CHECK ("status" in ('pending_payment','awaiting_materials','in_review','changes_requested','approved','rejected')),
	CONSTRAINT "ad_orders_amount_check" CHECK ("amount" > 0 AND "currency" = 'usd'),
	CONSTRAINT "ad_orders_version_check" CHECK ("version" > 0),
	CONSTRAINT "ad_orders_dates_check" CHECK (("starts_at" IS NULL AND "paid_through" IS NULL) OR ("starts_at" IS NOT NULL AND "paid_through" IS NOT NULL AND "paid_through" > "starts_at"))
);
--> statement-breakpoint
CREATE TABLE "ad_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"order_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"reference" text NOT NULL,
	"confirmed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ad_payments_kind_check" CHECK ("kind" in ('initial','renewal')),
	CONSTRAINT "ad_payments_amount_check" CHECK ("amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "ad_uploads" (
	"key" text PRIMARY KEY,
	"order_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ad_notifications_due_idx" ON "ad_notifications" ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "ad_orders_email_idx" ON "ad_orders" ("email");--> statement-breakpoint
CREATE INDEX "ad_orders_review_idx" ON "ad_orders" ("status","created_at");--> statement-breakpoint
CREATE INDEX "ad_payments_order_idx" ON "ad_payments" ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ad_payments_reference_unique" ON "ad_payments" (lower("reference"));--> statement-breakpoint
ALTER TABLE "ad_notifications" ADD CONSTRAINT "ad_notifications_order_id_ad_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ad_orders"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ad_orders" ADD CONSTRAINT "ad_orders_campaign_id_ad_campaigns_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ad_payments" ADD CONSTRAINT "ad_payments_order_id_ad_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ad_orders"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ad_payments" ADD CONSTRAINT "ad_payments_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "ad_uploads" ADD CONSTRAINT "ad_uploads_order_id_ad_orders_id_fkey" FOREIGN KEY ("order_id") REFERENCES "ad_orders"("id") ON DELETE CASCADE;