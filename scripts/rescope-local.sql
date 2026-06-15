-- Re-scope a LOCAL database's data to your local Clerk identity.
--
-- Why: listings/POIs/labels/home_settings are scoped by Clerk org_id /
-- owner_clerk_user_id. A Neon branch copied from prod owns its rows under your
-- PRODUCTION (pk_live) Clerk ids, so your local DEVELOPMENT (pk_test) login
-- won't see them. This re-points the rows to your dev ids.
--
-- ⚠️  SAFETY: run ONLY against a Neon branch / throwaway dev database.
--     NEVER run against production — it rewrites row ownership.
--
-- Fill in the placeholders, then run:
--     psql "$DATABASE_URL" -f scripts/rescope-local.sql
--
--   <PROD_ORG_ID>   org_id currently on the rows (from any prod row)
--   <DEV_ORG_ID>    your local Development-instance org id
--                   (Clerk dashboard -> Development -> Organizations)
--   <PROD_USER_ID> / <DEV_USER_ID>  only for personal-scope rows (org_id IS NULL)

BEGIN;

-- Org-scoped data
UPDATE listings           SET org_id = '<DEV_ORG_ID>' WHERE org_id = '<PROD_ORG_ID>';
UPDATE points_of_interest SET org_id = '<DEV_ORG_ID>' WHERE org_id = '<PROD_ORG_ID>';
UPDATE labels             SET org_id = '<DEV_ORG_ID>' WHERE org_id = '<PROD_ORG_ID>';
UPDATE home_settings      SET org_id = '<DEV_ORG_ID>' WHERE org_id = '<PROD_ORG_ID>';

-- Personal-scoped data (org_id IS NULL) — uncomment and fill if you use it:
-- UPDATE listings           SET owner_clerk_user_id = '<DEV_USER_ID>' WHERE owner_clerk_user_id = '<PROD_USER_ID>';
-- UPDATE points_of_interest SET owner_clerk_user_id = '<DEV_USER_ID>' WHERE owner_clerk_user_id = '<PROD_USER_ID>';
-- UPDATE labels             SET owner_clerk_user_id = '<DEV_USER_ID>' WHERE owner_clerk_user_id = '<PROD_USER_ID>';
-- UPDATE home_settings      SET owner_clerk_user_id = '<DEV_USER_ID>' WHERE owner_clerk_user_id = '<PROD_USER_ID>';

-- comments / reactions / listing_changes / listing_photos / listing_* cascade
-- from listings (by listing_id), so they don't need re-scoping.

COMMIT;
