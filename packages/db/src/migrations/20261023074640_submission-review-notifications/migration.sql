CREATE TABLE "submission_review_notifications" (
	"id" uuid PRIMARY KEY,
	"project_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"project_name" text NOT NULL,
	"project_slug" text NOT NULL,
	"outcome" text NOT NULL,
	"rejection_reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"first_attempt_at" timestamp with time zone,
	"lease_until" timestamp with time zone,
	"lease_token" uuid,
	"payload" jsonb,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_notifications_outcome_check" CHECK ("outcome" in ('published', 'rejected')),
	CONSTRAINT "review_notifications_status_check" CHECK ("status" in ('pending', 'sent', 'failed', 'cancelled')),
	CONSTRAINT "review_notifications_attempts_check" CHECK ("attempts" >= 0),
	CONSTRAINT "review_notifications_feedback_check" CHECK ("outcome" <> 'rejected' or length(trim("rejection_reason")) > 0 and "rejection_reason" is not null)
);
--> statement-breakpoint
CREATE INDEX "review_notifications_due_idx" ON "submission_review_notifications" ("next_attempt_at") WHERE "status" = 'pending';--> statement-breakpoint
ALTER TABLE "submission_review_notifications" ADD CONSTRAINT "submission_review_notifications_id_audit_log_id_fkey" FOREIGN KEY ("id") REFERENCES "audit_log"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "submission_review_notifications" ADD CONSTRAINT "submission_review_notifications_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "submission_review_notifications" ADD CONSTRAINT "submission_review_notifications_recipient_id_user_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "user"("id") ON DELETE CASCADE;