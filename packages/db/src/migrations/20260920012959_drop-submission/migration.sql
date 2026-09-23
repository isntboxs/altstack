ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_submission_id_submissions_id_fkey";--> statement-breakpoint
DROP TABLE "submissions";--> statement-breakpoint
DROP INDEX "audit_log_submissionId_idx";--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "action" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "audit_log" DROP COLUMN "submission_id";--> statement-breakpoint
DROP TYPE "submission_status";