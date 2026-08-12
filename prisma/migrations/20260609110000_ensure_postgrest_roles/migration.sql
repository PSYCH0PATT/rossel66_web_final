-- 20260609120000_enable_rls_server_only revokes access from `anon` and `authenticated`, the two
-- roles PostgREST uses on Supabase. Those roles exist only on Supabase, so that migration fails
-- with `role "anon" does not exist` on any other Postgres — Neon staging, a local container, or
-- a self-hosted instance. `prisma migrate deploy` then stops there, and entrypoint.sh runs it on
-- every container start.
--
-- This runs one hour earlier and creates the roles when they are missing. On Supabase both
-- already exist and nothing happens. Elsewhere they are created NOLOGIN — nobody can connect as
-- them, they exist purely so the REVOKE in the next migration has a subject.
--
-- Deliberately a new migration rather than an edit to the failing one: that migration is already
-- applied in production, and Prisma compares checksums — editing it would break deploys on every
-- database where it has run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;
