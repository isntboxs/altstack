CREATE TABLE "project_claims" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"challenge_id" uuid NOT NULL,
	"code_hash" text,
	"code_expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"sent_at" timestamp,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"email_verified_at" timestamp,
	"reviewer_id" uuid,
	"reviewed_at" timestamp,
	CONSTRAINT "project_claims_role_check" CHECK ("role" IN ('owner', 'maintainer')),
	CONSTRAINT "project_claims_status_check" CHECK ("status" IN ('email_pending', 'pending', 'approved', 'rejected')),
	CONSTRAINT "project_claims_attempts_check" CHECK ("attempts" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"project_id" uuid,
	"user_id" uuid,
	"role" text NOT NULL,
	"approved_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_members_pkey" PRIMARY KEY("project_id","user_id"),
	CONSTRAINT "project_members_role_check" CHECK ("role" IN ('owner', 'maintainer'))
);
--> statement-breakpoint
CREATE TABLE "project_uploads" (
	"key" text PRIMARY KEY,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "project_claims_project_user_idx" ON "project_claims" ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "project_claims_status_requested_idx" ON "project_claims" ("status","requested_at");--> statement-breakpoint
CREATE INDEX "project_claims_user_idx" ON "project_claims" ("user_id");--> statement-breakpoint
CREATE INDEX "project_members_user_idx" ON "project_members" ("user_id");--> statement-breakpoint
CREATE INDEX "project_uploads_project_user_idx" ON "project_uploads" ("project_id","user_id");--> statement-breakpoint
ALTER TABLE "project_claims" ADD CONSTRAINT "project_claims_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_claims" ADD CONSTRAINT "project_claims_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_claims" ADD CONSTRAINT "project_claims_reviewer_id_user_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_approved_by_user_id_fkey" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "project_uploads" ADD CONSTRAINT "project_uploads_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_uploads" ADD CONSTRAINT "project_uploads_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_action_check", ADD CONSTRAINT "audit_log_action_check" CHECK ("action" in ('project_created', 'project_updated', 'project_removed', 'project_submitted', 'project_status_changed', 'project_claim_requested', 'project_claim_approved', 'project_claim_rejected', 'project_member_updated'));