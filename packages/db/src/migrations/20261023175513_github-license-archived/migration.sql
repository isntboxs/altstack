ALTER TABLE "github_repositories" ADD COLUMN "license_key" text;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "license_name" text;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "license_spdx_id" text;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "license_slug" text;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "license_url" text;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "archived" boolean;--> statement-breakpoint
CREATE INDEX "github_repo_license_slug_idx" ON "github_repositories" ("license_slug");