ALTER TABLE "projects" ADD COLUMN "submitter_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "tagline" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "logo" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_repository_canonical_idx" ON "projects" (lower(regexp_replace(regexp_replace(rtrim("repository_url", '/'), '^https?://(www[.])?github[.]com/', 'https://github.com/', 'i'), '[.]git$', '', 'i')));--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_submitter_id_user_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_action_check", ADD CONSTRAINT "audit_log_action_check" CHECK ("action" in ('project_created', 'project_updated', 'project_removed', 'project_submitted', 'project_status_changed'));