-- Marketplace permissions are independent from content permissions.
-- Backfill existing system roles without relying on NULL-aware uniqueness.
INSERT INTO "permissions" ("id", "role_id", "action", "resource", "effect")
SELECT gen_random_uuid(), r."id", action.name, NULL, 'allow'
FROM "roles" r
CROSS JOIN (VALUES ('market:read'), ('market:write'), ('market:purchase')) AS action(name)
WHERE r."name" IN ('owner', 'admin')
  AND NOT EXISTS (
    SELECT 1 FROM "permissions" p
    WHERE p."role_id" = r."id" AND p."action" = action.name AND p."resource" IS NULL
  );

INSERT INTO "permissions" ("id", "role_id", "action", "resource", "effect")
SELECT gen_random_uuid(), r."id", action.name, NULL, 'allow'
FROM "roles" r
CROSS JOIN (VALUES ('market:read'), ('market:purchase')) AS action(name)
WHERE r."name" = 'member'
  AND NOT EXISTS (
    SELECT 1 FROM "permissions" p
    WHERE p."role_id" = r."id" AND p."action" = action.name AND p."resource" IS NULL
  );
