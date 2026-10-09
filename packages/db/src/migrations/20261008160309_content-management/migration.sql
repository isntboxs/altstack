ALTER TABLE "projects" ADD COLUMN "submitter_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "tagline" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "logo" DROP NOT NULL;--> statement-breakpoint
-- Require explicit cleanup of legacy canonical duplicates; never choose a
-- survivor or delete projects, assignments, media, or audit history implicitly.
LOCK TABLE "projects" IN SHARE ROW EXCLUSIVE MODE;--> statement-breakpoint
DO $$
DECLARE
  duplicates text;
BEGIN
  SELECT string_agg(canonical_url || ': ' || project_ids, E'\n') INTO duplicates
  FROM (
    SELECT lower(regexp_replace(regexp_replace(rtrim("repository_url", '/'), '^https?://(www[.])?github[.]com/', 'https://github.com/', 'i'), '[.]git$', '', 'i')) AS canonical_url,
      string_agg("id"::text, ', ' ORDER BY "id") AS project_ids
    FROM "projects"
    GROUP BY canonical_url
    HAVING count(*) > 1
    ORDER BY canonical_url
    LIMIT 10
  ) conflicts;
  IF duplicates IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23505',
      MESSAGE = 'Content management migration requires canonical repository duplicate cleanup.',
      DETAIL = duplicates,
      HINT = 'Resolve the listed duplicate project IDs before retrying. No projects are deleted by this migration.';
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_repository_canonical_idx" ON "projects" (lower(regexp_replace(regexp_replace(rtrim("repository_url", '/'), '^https?://(www[.])?github[.]com/', 'https://github.com/', 'i'), '[.]git$', '', 'i')));--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_submitter_id_user_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_action_check", ADD CONSTRAINT "audit_log_action_check" CHECK ("action" in ('project_created', 'project_updated', 'project_removed', 'project_submitted', 'project_status_changed'));
