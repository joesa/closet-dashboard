#!/usr/bin/env bash
#
# Redeploy the worker on the VM, then reclaim what the rebuild stranded.
#
#   cd ~/closet-dashboard && ./worker/scripts/redeploy.sh
#
# Render rebuilt and swept disk for you. A bare VM does neither. Each
# `up -d --build` bakes a fresh ~2GB image and orphans the previous one, plus
# build cache — roughly a dozen redeploys is enough to fill a 40GB boot disk.
# The failure mode is quiet: builds start failing, or the container dies with
# ENOSPC and jobs stop being claimed while sitting safely in graphile_worker.jobs.
#
# Runtime growth is NOT a concern: the job path writes nothing to local disk
# (generated images stream to Supabase Storage) and container logs are capped by
# the logging block in docker-compose.prod.yml.
set -euo pipefail

cd "$(dirname "$0")/../.."
COMPOSE="worker/docker-compose.prod.yml"

echo "== disk before =="
df -h --output=source,size,used,avail,pcent . | tail -1

# The guard runs BEFORE the pull, deliberately. If it aborted after pulling, the
# clone would sit ahead of the running image, and an automated caller comparing
# HEAD to origin/main would conclude it was already up to date and never deploy
# the change at all. Abort must leave the checkout exactly as it found it.
#
# Never recreate the container out from under a running job. Doing so kills the
# worker while it still holds the row lock, and Graphile hands that job to
# nobody until the lock expires — 4 hours by default. It looks frozen mid-run
# next to an idle worker, which is a genuinely confusing thing to debug.
#
# Skipped when nothing is running yet (first deploy). FORCE=1 overrides, and
# then the recovery is:
#   force_unlock_workers(array['<locked_by>'])   -- see worker/src/lockedJobs.ts
if docker compose -f "$COMPOSE" ps --status running --quiet | grep -q .; then
  echo "== checking for in-flight jobs =="
  if LOCKED=$(docker compose -f "$COMPOSE" exec -T graphile-worker \
      ./node_modules/.bin/tsx --tsconfig worker/tsconfig.json worker/src/lockedJobs.ts 2>&1 | tail -1) \
      && [ "$LOCKED" -eq "$LOCKED" ] 2>/dev/null; then
    if [ "$LOCKED" -gt 0 ] && [ -z "${FORCE:-}" ]; then
      echo "ABORT: $LOCKED job(s) currently locked by the worker." >&2
      echo "Redeploying now would strand them for ~4h. Wait, or re-run with FORCE=1." >&2
      exit 1
    fi
    echo "in-flight jobs: $LOCKED"
  else
    # A failed check must not read as "nothing running".
    echo "ABORT: could not determine in-flight job count ($LOCKED)." >&2
    echo "Re-run with FORCE=1 if you are sure nothing is mid-job." >&2
    [ -z "${FORCE:-}" ] && exit 1
  fi
fi

git pull --ff-only

# WORKER_MEM_LIMIT is a compose substitution variable read from the shell, so it
# has to be exported here rather than living in .env.local. Default suits a 6GB
# host; export 8g before running this on a 12GB one.
export WORKER_MEM_LIMIT="${WORKER_MEM_LIMIT:-4g}"
echo "mem_limit=$WORKER_MEM_LIMIT"

docker compose -f "$COMPOSE" up -d --build

# Prune AFTER the new container is up, never before: an image still referenced
# by a running container is never removed, so this only reclaims the orphans.
echo "== reclaiming =="
docker image prune -f
# Keep recent cache so the next build is not from scratch; drop the rest.
docker builder prune -f --filter until=168h

echo "== disk after =="
df -h --output=source,size,used,avail,pcent . | tail -1

docker compose -f "$COMPOSE" ps
echo
echo "Tail the worker with:"
echo "  docker compose -f $COMPOSE logs -f"
