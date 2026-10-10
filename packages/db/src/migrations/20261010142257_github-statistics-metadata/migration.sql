ALTER TABLE "github_repositories" ADD COLUMN "last_commit_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "repository_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "latest_release_tag" text;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "metadata_fetched_at" timestamp with time zone;