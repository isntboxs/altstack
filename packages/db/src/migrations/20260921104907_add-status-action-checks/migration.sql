ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_action_check" CHECK ("action" in ('project_removed')) NOT VALID;--> statement-breakpoint
ALTER TABLE "audit_log" VALIDATE CONSTRAINT "audit_log_action_check";--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_status_check" CHECK ("status" in ('draft', 'published', 'rejected', 'removed')) NOT VALID;--> statement-breakpoint
ALTER TABLE "projects" VALIDATE CONSTRAINT "projects_status_check";