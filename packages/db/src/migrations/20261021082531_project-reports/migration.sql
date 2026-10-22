CREATE TABLE "project_reports" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"type" text NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_reports_type_check" CHECK ("type" IN ('broken_link', 'wrong_category', 'outdated', 'other')),
	CONSTRAINT "project_reports_email_check" CHECK (char_length("email") BETWEEN 3 AND 254 AND "email" = btrim("email")),
	CONSTRAINT "project_reports_message_check" CHECK (char_length("message") <= 2000 AND "message" = btrim("message") AND ("type" <> 'other' OR char_length("message") > 0))
);
--> statement-breakpoint
CREATE INDEX "project_reports_project_created_idx" ON "project_reports" ("project_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "project_reports_user_idx" ON "project_reports" ("user_id");--> statement-breakpoint
ALTER TABLE "project_reports" ADD CONSTRAINT "project_reports_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_reports" ADD CONSTRAINT "project_reports_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;