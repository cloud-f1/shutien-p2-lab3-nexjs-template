-- Replace the role enum ["user","admin"] with ["admin","editor","viewer"].
-- Postgres cannot drop a value from an enum in place, so we route through text:
--   1. drop the old enum-typed DEFAULT, detach the column from the old enum (cast to text)
--   2. drop the old enum type, create the new one
--   3. re-attach the column with a value-mapping USING clause:
--        'user'  -> 'viewer'   (old default / read-only tier)
--        'admin' -> 'admin'    (unchanged)
--      any other / NULL text   -> 'viewer'  (safe fallback)
--   4. set DEFAULT 'viewer'
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."role";--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'editor', 'viewer');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."role" USING (
  CASE "role"
    WHEN 'user' THEN 'viewer'
    WHEN 'admin' THEN 'admin'
    WHEN 'editor' THEN 'editor'
    WHEN 'viewer' THEN 'viewer'
    ELSE 'viewer'
  END
)::"public"."role";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'viewer'::"public"."role";
