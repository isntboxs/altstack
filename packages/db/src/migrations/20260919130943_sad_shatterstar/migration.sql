CREATE TYPE "audit_status" AS ENUM('submission_approved', 'submission_rejected', 'submission_resubmitted', 'project_removed');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
	"actor_id" uuid,
	"action" "audit_status" NOT NULL,
	"submission_id" uuid,
	"project_id" uuid,
	"reason" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_log_actorId_idx" ON "audit_log" ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_submissionId_idx" ON "audit_log" ("submission_id");--> statement-breakpoint
CREATE INDEX "audit_log_projectId_idx" ON "audit_log" ("project_id");--> statement-breakpoint
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log" ("created_at");--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_submission_id_submissions_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;