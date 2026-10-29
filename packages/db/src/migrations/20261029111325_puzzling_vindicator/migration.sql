CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
	"name" varchar(120) NOT NULL,
	"slug" varchar(100) NOT NULL UNIQUE,
	"description" varchar(300) NOT NULL,
	"content" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"source_repository_url" text,
	"main_project_id" uuid,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collections_kind_check" CHECK ("kind" IN ('alternatives','repository','ecosystem')),
	CONSTRAINT "collections_status_check" CHECK ("status" IN ('draft','published')),
	CONSTRAINT "collections_source_check" CHECK (("kind" = 'repository' AND "source_repository_url" IS NOT NULL AND "main_project_id" IS NULL) OR ("kind" <> 'repository' AND "source_repository_url" IS NULL)),
	CONSTRAINT "collections_version_check" CHECK ("version" > 0)
);
--> statement-breakpoint
CREATE TABLE "collection_members" (
	"collection_id" uuid,
	"project_id" uuid,
	"position" integer NOT NULL,
	CONSTRAINT "collection_members_pkey" PRIMARY KEY("collection_id","project_id"),
	CONSTRAINT "collection_members_position_unique" UNIQUE("collection_id","position"),
	CONSTRAINT "collection_members_position_check" CHECK ("position" >= 0 AND "position" < 100)
);
--> statement-breakpoint
CREATE INDEX "collections_status_updated_idx" ON "collections" ("status","updated_at");--> statement-breakpoint
CREATE INDEX "collections_main_project_idx" ON "collections" ("main_project_id");--> statement-breakpoint
CREATE INDEX "collection_members_project_idx" ON "collection_members" ("project_id");--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_main_project_id_projects_id_fkey" FOREIGN KEY ("main_project_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_author_id_user_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "collection_members" ADD CONSTRAINT "collection_members_collection_id_collections_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "collection_members" ADD CONSTRAINT "collection_members_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;