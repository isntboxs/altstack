CREATE TABLE "about_page" (
	"id" text PRIMARY KEY DEFAULT 'about',
	"title" varchar(200) NOT NULL,
	"description" varchar(500) NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "about_page_singleton_check" CHECK ("id" = 'about'),
	CONSTRAINT "about_page_version_check" CHECK ("version" > 0)
);
