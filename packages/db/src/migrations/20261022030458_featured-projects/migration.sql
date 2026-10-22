CREATE TABLE "featured_projects" (
	"project_id" uuid PRIMARY KEY,
	"position" integer NOT NULL UNIQUE,
	CONSTRAINT "featured_projects_position_check" CHECK ("position" >= 0 AND "position" < 21)
);
--> statement-breakpoint
ALTER TABLE "featured_projects" ADD CONSTRAINT "featured_projects_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;