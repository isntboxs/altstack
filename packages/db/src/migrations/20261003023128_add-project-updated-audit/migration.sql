ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_action_check";--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_action_check" CHECK ("action" in ('project_created', 'project_updated', 'project_removed')) NOT VALID;--> statement-breakpoint
ALTER TABLE "audit_log" VALIDATE CONSTRAINT "audit_log_action_check";
