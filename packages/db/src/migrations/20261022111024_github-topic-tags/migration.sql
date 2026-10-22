CREATE TABLE "project_tags" (
	"project_id" uuid,
	"tag_id" uuid,
	CONSTRAINT "project_tags_pkey" PRIMARY KEY("project_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_slug_check" CHECK ("slug" ~ '^[a-z0-9][a-z0-9-]{0,49}$')
);
--> statement-breakpoint
CREATE INDEX "project_tag_tag_idx" ON "project_tags" ("tag_id");--> statement-breakpoint
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_tag_id_tags_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT;