CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
	"title" varchar(200) NOT NULL,
	"slug" varchar(160) NOT NULL UNIQUE,
	"description" varchar(500) NOT NULL,
	"cover_url" text NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"author_id" uuid,
	"author_name" text NOT NULL,
	"read_time" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_status_check" CHECK ("status" IN ('draft', 'published')),
	CONSTRAINT "blog_posts_publication_check" CHECK ("status" <> 'published' OR "published_at" IS NOT NULL),
	CONSTRAINT "blog_posts_version_check" CHECK ("version" > 0),
	CONSTRAINT "blog_posts_read_time_check" CHECK ("read_time" > 0)
);
--> statement-breakpoint
CREATE INDEX "blog_posts_status_published_idx" ON "blog_posts" ("status","published_at");--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_user_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE SET NULL;