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

git pull --ff-only

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
