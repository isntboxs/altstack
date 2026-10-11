CREATE TABLE "github_star_history" (
	"project_id" uuid,
	"snapshot_date" date,
	"stars" integer NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "github_star_history_pkey" PRIMARY KEY("project_id","snapshot_date"),
	CONSTRAINT "github_star_history_stars_nonnegative" CHECK ("stars" >= 0)
);
--> statement-breakpoint
ALTER TABLE "github_repositories" ADD COLUMN "github_repository_id" bigint;--> statement-breakpoint
CREATE INDEX "github_star_history_date_idx" ON "github_star_history" ("snapshot_date");--> statement-breakpoint
ALTER TABLE "github_star_history" ADD CONSTRAINT "github_star_history_7whKIChHjWpK_fkey" FOREIGN KEY ("project_id") REFERENCES "github_repositories"("project_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repository_id_positive" CHECK ("github_repository_id" > 0);