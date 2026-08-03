#!/usr/bin/env bash
#
# Poll origin/main and redeploy the worker when something that actually ships
# in the image has changed. Driven by worker-auto-update.timer.
#
# Polling rather than a webhook or a GitHub Actions SSH deploy, on purpose:
# the VM's security list allows no inbound port but SSH, and a push-based
# deploy would mean either opening a port or handing a private key to a CI
# runner. Pull-based keeps every credential on the box and needs no ingress.
#
# Safe to run on a timer because redeploy.sh refuses to recreate the container
# while a job holds a lock, and it aborts BEFORE pulling — so an abort leaves
# the checkout untouched and the next tick retries the same change.
set -euo pipefail

cd "$(dirname "$0")/../.."

# Paths whose contents end up inside the image. Everything else — docs, CI
# config, the ops runbook — changes nothing about the running worker, so it
# should not trigger a rebuild and a container recreate.
RUNTIME_PATHS=(src worker package.json package-lock.json .dockerignore)

log() { printf '%s %s\n' "$(date -Is)" "$1"; }

git fetch -q origin main

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

if git diff --name-only "$LOCAL" "$REMOTE" -- "${RUNTIME_PATHS[@]}" | grep -q .; then
  log "runtime change ${LOCAL:0:7}..${REMOTE:0:7} — redeploying"
  # Capture output so an expected in-flight abort can be reported as a normal
  # deferral instead of a unit failure that needs investigating.
  if OUT=$(./worker/scripts/redeploy.sh 2>&1); then
    log "redeploy ok -> $(git rev-parse --short HEAD)"
    printf '%s\n' "$OUT" | tail -5
  else
    if printf '%s' "$OUT" | grep -q 'ABORT:.*locked'; then
      log "deferred — a job is in flight; will retry next tick"
      exit 0
    fi
    log "REDEPLOY FAILED"
    printf '%s\n' "$OUT" | tail -30
    exit 1
  fi
else
  # Docs or CI only. Move the checkout forward so the next comparison is honest,
  # but leave the container alone.
  git merge -q --ff-only origin/main
  log "non-runtime change only — checkout advanced to $(git rev-parse --short HEAD), no rebuild"
fi
