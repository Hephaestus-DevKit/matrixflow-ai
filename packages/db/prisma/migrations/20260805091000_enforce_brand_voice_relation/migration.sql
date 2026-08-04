-- Remove invalid legacy references before enforcing tenant-safe relational integrity.
UPDATE "content_projects" cp
SET "brand_voice_id" = NULL
WHERE cp."brand_voice_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "brand_voices" bv
    WHERE bv."id" = cp."brand_voice_id"
      AND bv."organization_id" = cp."organization_id"
  );

CREATE UNIQUE INDEX IF NOT EXISTS "brand_voices_id_organization_id_key"
ON "brand_voices"("id", "organization_id");

CREATE INDEX IF NOT EXISTS "content_projects_brand_voice_id_organization_id_idx"
ON "content_projects"("brand_voice_id", "organization_id");

ALTER TABLE "content_projects"
ADD CONSTRAINT "content_projects_brand_voice_id_organization_id_fkey"
FOREIGN KEY ("brand_voice_id", "organization_id")
REFERENCES "brand_voices"("id", "organization_id")
ON DELETE RESTRICT ON UPDATE CASCADE;
