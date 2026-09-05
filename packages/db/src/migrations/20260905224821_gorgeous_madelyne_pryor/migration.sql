CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
	"slug" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_categories" (
	"project_id" uuid,
	"category_id" uuid,
	CONSTRAINT "project_categories_pkey" PRIMARY KEY("project_id","category_id")
);
--> statement-breakpoint
CREATE INDEX "category_slug_idx" ON "categories" ("slug");--> statement-breakpoint
CREATE INDEX "project_category_category_idx" ON "project_categories" ("category_id");--> statement-breakpoint
ALTER TABLE "project_categories" ADD CONSTRAINT "project_categories_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "project_categories" ADD CONSTRAINT "project_categories_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE;