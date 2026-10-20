CREATE TABLE "bookmarks" (
	"user_id" uuid,
	"project_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_pkey" PRIMARY KEY("user_id","project_id")
);
--> statement-breakpoint
CREATE INDEX "bookmarks_user_created_idx" ON "bookmarks" ("user_id","created_at" DESC NULLS LAST,"project_id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "bookmarks_project_idx" ON "bookmarks" ("project_id");--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;