ALTER TABLE "project_reports" ADD COLUMN "status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_reports" ALTER COLUMN "project_id" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "project_reports_status_created_id_idx" ON "project_reports" ("status","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "project_reports_created_id_idx" ON "project_reports" ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "project_reports" DROP CONSTRAINT "project_reports_project_id_projects_id_fkey", ADD CONSTRAINT "project_reports_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "project_reports" ADD CONSTRAINT "project_reports_status_check" CHECK ("status" IN ('open', 'resolved', 'dismissed'));