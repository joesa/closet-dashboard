#!/usr/bin/env bash
#
# One-shot bootstrap for the Graphile Worker host (Oracle Always Free A1.Flex,
# Ubuntu 24.04 arm64 — but nothing here is Oracle-specific; any Debian/Ubuntu
# VM works). Installs Docker, clones the dashboard, and stages .env.local.
#
# Run on a fresh VM as the default `ubuntu` user:
#
#   curl -fsSL https://raw.githubusercontent.com/joesa/closet-dashboard/main/worker/scripts/oracle-vm-bootstrap.sh | bash
#
# Idempotent: safe to re-run. It never overwrites an existing .env.local, and it
# deliberately stops short of starting the worker — the container is useless
# until real secrets are in place, and a boot loop against an empty DATABASE_URL
# just fills the logs.
#
# EVERYTHING lives inside main(), which is called on the last line. That is not
# style: under `curl | bash` the script arrives on stdin, and apt-get reads
# stdin. A top-level script gets its unread remainder eaten mid-run, after which
# bash sees EOF and exits 0 — Docker installed, repo never cloned, and no error
# anywhere. Wrapping the body in a function forces bash to parse all of it
# before executing any of it. The `</dev/null` on each apt call is the second belt.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/joesa/closet-dashboard.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
APP_DIR="${APP_DIR:-$HOME/closet-dashboard}"
COMPOSE_FILE="worker/docker-compose.prod.yml"

export DEBIAN_FRONTEND=noninteractive

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$1"; }

main() {
  if [ "$(id -u)" -eq 0 ]; then
    echo "Run as a normal user (e.g. ubuntu), not root — this adds you to the docker group." >&2
    exit 1
  fi

  log "Installing base packages"
  sudo -E apt-get update -qq </dev/null
  sudo -E apt-get install -y -qq ca-certificates curl git gnupg </dev/null

  # Docker Engine from Docker's own repo. Ubuntu's docker.io package lags and
  # does not ship the compose v2 plugin that docker-compose.prod.yml needs.
  if ! command -v docker >/dev/null 2>&1; then
    log "Installing Docker Engine + compose plugin"
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
      sudo gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" |
      sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
    sudo -E apt-get update -qq </dev/null
    sudo -E apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
      docker-buildx-plugin docker-compose-plugin </dev/null
  else
    log "Docker already installed — skipping"
  fi

  # Survives reboots. A worker that does not come back after a reboot is the
  # whole failure mode this migration has to avoid.
  log "Enabling Docker at boot"
  sudo systemctl enable --now docker

  if ! id -nG "$USER" | tr ' ' '\n' | grep -qx docker; then
    log "Adding $USER to the docker group"
    sudo usermod -aG docker "$USER"
    NEEDS_RELOGIN=1
  fi

  # Every `up -d --build` strands the previous ~2GB image plus build cache.
  # worker/scripts/redeploy.sh sweeps as it goes, but a manual rebuild will not
  # — and a full boot disk kills the worker with ENOSPC. This is the backstop.
  # Images referenced by a running container are never touched by prune.
  log "Installing weekly Docker prune timer"
  sudo tee /etc/systemd/system/docker-prune.service >/dev/null <<'UNIT'
[Unit]
Description=Reclaim orphaned Docker images and build cache

[Service]
Type=oneshot
ExecStart=/usr/bin/docker image prune -af --filter until=168h
ExecStart=/usr/bin/docker builder prune -f --filter until=168h
UNIT
  sudo tee /etc/systemd/system/docker-prune.timer >/dev/null <<'UNIT'
[Unit]
Description=Weekly Docker prune

[Timer]
OnCalendar=weekly
Persistent=true

[Install]
WantedBy=timers.target
UNIT
  sudo systemctl daemon-reload
  sudo systemctl enable --now docker-prune.timer

  log "Fetching the dashboard into $APP_DIR"
  if [ -d "$APP_DIR/.git" ]; then
    git -C "$APP_DIR" fetch --quiet origin "$REPO_BRANCH"
    git -C "$APP_DIR" checkout --quiet "$REPO_BRANCH"
    git -C "$APP_DIR" pull --quiet --ff-only origin "$REPO_BRANCH"
  else
    git clone --quiet --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
  fi

  # docker-compose.prod.yml reads ../.env.local relative to worker/, i.e. repo root.
  if [ -f "$APP_DIR/.env.local" ]; then
    log ".env.local already present — leaving it untouched"
  else
    log "Staging .env.local from worker/worker.env.example"
    cp "$APP_DIR/worker/worker.env.example" "$APP_DIR/.env.local"
    chmod 600 "$APP_DIR/.env.local"
    warn "Secrets are NOT filled in yet."
  fi

  cat <<EOF

------------------------------------------------------------------
Bootstrap complete. Two things left, in order:

1. Fill in the secrets:
     nano $APP_DIR/.env.local

   DATABASE_URL must be the Supabase SESSION-mode URI on port 5432.
   The transaction pooler (:6543) breaks LISTEN/NOTIFY and is rejected
   at startup by getGraphileDatabaseUrl().

2. Start the worker:
     cd $APP_DIR && docker compose -f $COMPOSE_FILE up -d --build
     docker compose -f $COMPOSE_FILE logs -f

   Expect: [worker] connected — listening for jobs
------------------------------------------------------------------
EOF

  if [ -n "${NEEDS_RELOGIN:-}" ]; then
    warn "Log out and back in (or run 'newgrp docker') before step 2 — your"
    warn "shell does not have the docker group yet."
  fi
}

main "$@"
