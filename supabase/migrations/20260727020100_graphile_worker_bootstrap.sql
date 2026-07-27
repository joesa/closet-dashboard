-- Bootstrap placeholder for Graphile Worker.
--
-- The full graphile_worker schema (jobs, add_job, LISTEN/NOTIFY, etc.) is
-- installed by Graphile's official migrator, not by hand-copied SQL:
--
--   npm run worker:migrate
--
-- `scripts/db-migrate.sh` invokes that after applying this file when
-- DATABASE_URL is set (session-mode Postgres on port 5432).
--
-- This migration is intentionally a no-op so deploy ordering stays:
--   1) background_job columns (prior migration)
--   2) this marker
--   3) graphile_worker schema via worker:migrate

select 1;
