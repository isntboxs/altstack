ALTER TABLE "audit_log" ALTER COLUMN "action" SET DATA TYPE text USING "action"::text;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "status" SET DATA TYPE text USING "status"::text;--> statement-breakpoint
DROP TYPE "audit_status";--> statement-breakpoint
DROP TYPE "project_status";