CREATE TYPE "submission_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
	"name" text NOT NULL,
	"submitter_id" uuid NOT NULL,
	"repository_url" text NOT NULL UNIQUE,
	"website_url" text,
	"status" "submission_status" DEFAULT 'pending'::"submission_status" NOT NULL,
	"rejection_reason" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"moderated_at" timestamp,
	"moderated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "submission_submitterId_idx" ON "submissions" ("submitter_id");--> statement-breakpoint
CREATE INDEX "submission_status_idx" ON "submissions" ("status");--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submitter_id_user_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_moderated_by_user_id_fkey" FOREIGN KEY ("moderated_by") REFERENCES "user"("id") ON DELETE SET NULL;