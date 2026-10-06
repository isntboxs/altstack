CREATE TABLE "category_paths" (
	"path" text PRIMARY KEY,
	"category_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
CREATE INDEX "category_parent_idx" ON "categories" ("parent_id");--> statement-breakpoint
CREATE INDEX "category_path_category_idx" ON "category_paths" ("category_id");--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "category_paths" ADD CONSTRAINT "category_paths_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_not_self_parent_check" CHECK ("parent_id" <> "id");--> statement-breakpoint
-- All existing categories are roots; preserve their original slug paths.
INSERT INTO "category_paths" ("path", "category_id")
SELECT "slug", "id" FROM "categories";
