#!/usr/bin/env bash
# =============================================================================
# db-migrate.sh — apply pending migrations to the shared Supabase DB.
# =============================================================================
# This project shares its Supabase database with other projects, so the
# default `supabase db push` workflow doesn't work (it enforces strict
# local↔remote parity and refuses to run when remote has migrations that
# don't exist locally).
#
# Workflow this script implements:
#   1. For every file in supabase/migrations/<TS>_<name>.sql whose <TS>
#      isn't yet in the remote schema_migrations table, apply it via
#      psql, then call `supabase migration repair --status applied <TS>`
#      so future runs see it as applied.
#   2. If --dry-run is passed, only list what would be applied.
#
# Requires .env.local with SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD,
# plus a `supabase link` already completed.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env.local ]]; then
  echo "error: .env.local not found in $(pwd)" >&2
  exit 1
fi
set -a; . ./.env.local; set +a

POOLER_URL=$(cat supabase/.temp/pooler-url 2>/dev/null || true)
if [[ -z "$POOLER_URL" ]]; then
  echo "error: supabase/.temp/pooler-url missing. Run 'supabase link --project-ref vtlvqatzsolycqzeknru' first." >&2
  exit 1
fi

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=1; fi

# Fetch the set of versions already applied on remote.
APPLIED=$(PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$POOLER_URL" -tAc \
  "select version from supabase_migrations.schema_migrations" 2>/dev/null \
  | tr -d ' ')

shopt -s nullglob
PENDING=()
for f in supabase/migrations/*.sql; do
  base=$(basename "$f")
  ts="${base%%_*}"
  if ! grep -qx "$ts" <<<"$APPLIED"; then
    PENDING+=("$f")
  fi
done

if [[ ${#PENDING[@]} -eq 0 ]]; then
  echo "No pending SQL migrations."
else
  echo "Pending migrations:"
  printf '  %s\n' "${PENDING[@]}"
fi

if [[ $DRY_RUN -eq 1 ]]; then
  echo "(dry run — exiting)"
  exit 0
fi

for f in "${PENDING[@]}"; do
  ts=$(basename "$f" | cut -d_ -f1)
  echo "▶ Applying $f ..."
  PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "$POOLER_URL" \
    -v ON_ERROR_STOP=1 -f "$f"
  echo "▶ Recording $ts as applied ..."
  supabase migration repair --status applied "$ts"
done

# Graphile Worker schema (jobs / add_job / LISTEN). Requires session-mode
# DATABASE_URL (port 5432), not the transaction pooler.
if [[ -z "${DATABASE_URL:-}" && -n "${SUPABASE_DB_PASSWORD:-}" && -n "${POOLER_URL:-}" ]]; then
  # Derive session URI from linked pooler URL + password (same host:5432).
  export POOLER_URL
  export SUPABASE_DB_PASSWORD
  DATABASE_URL="$(python3 - <<'PY'
import os, urllib.parse
pooler = os.environ["POOLER_URL"].strip()
pw = os.environ["SUPABASE_DB_PASSWORD"]
u = urllib.parse.urlparse(pooler)
user = u.username or "postgres"
host = u.hostname
port = u.port or 5432
db = (u.path or "/postgres").lstrip("/") or "postgres"
auth = urllib.parse.quote(user, safe="") + ":" + urllib.parse.quote(pw, safe="")
print(f"postgresql://{auth}@{host}:{port}/{db}?sslmode=require")
PY
)"
  export DATABASE_URL
  echo "▶ Derived DATABASE_URL from pooler + SUPABASE_DB_PASSWORD"
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "▶ graphile_worker schema (npm run worker:migrate) ..."
  npm run worker:migrate
else
  echo "⚠ DATABASE_URL unset — skip graphile_worker migrate."
  echo "  Set a session-mode Postgres URI and run: npm run worker:migrate"
fi

echo "✓ Done."
