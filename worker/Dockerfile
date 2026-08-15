# Graphile Worker image — always-on host for Full redesign + long AI jobs.
#
# Build context is the REPO ROOT, not worker/:
#   docker compose -f worker/docker-compose.prod.yml up -d --build
#
# The whole dashboard tree is required at runtime. worker/tsconfig.json maps
# @/* -> ../src/*, so the tasks import straight out of src/lib (processCustomBuildJob,
# supabase-admin, autoLaunch, …). Do not try to ship worker/ alone.
#
# node:22-bookworm-slim is multi-arch: the same Dockerfile builds on arm64
# (Oracle Ampere) and x86_64. glibc, so sharp resolves @img/sharp-linux-arm64.
FROM node:22-bookworm-slim

# tsx and dotenv are runtime `dependencies` (not devDependencies) specifically so
# they survive a production install — keep it that way if package.json changes.
ENV NODE_ENV=production

WORKDIR /app

# Deps first so the (slow) install layer caches across code-only changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Which commit this image contains. Declared AFTER the copy so changing it does
# not invalidate the (slow) npm ci layer. The worker writes these to
# public.worker_instances on boot, which is how "did the VM pick up my commit?"
# is answerable without SSHing to the box. redeploy.sh sets both; a hand-run
# `docker compose up --build` leaves them empty and the row reports unknown.
ARG GIT_SHA=""
ARG IMAGE_BUILT_AT=""
ENV WORKER_GIT_SHA=$GIT_SHA
ENV WORKER_IMAGE_BUILT_AT=$IMAGE_BUILT_AT

# Run as the node user rather than root; /app is only ever read at runtime.
USER node

# Exec tsx directly rather than `npm run worker`.
#
# npm does NOT forward SIGTERM to the script it spawns. As PID 1 it absorbed
# docker's stop signal, so the worker never ran its shutdown handler and was
# SIGKILLed at the end of the grace period — every clean redeploy looked like a
# crash in worker_instances, and a long job got no chance to drain. Verified by
# sending SIGTERM to both forms: via npm the handler never fires, exec'd
# directly it does. tsx itself relays signals to the process it loads.
CMD ["./node_modules/.bin/tsx", "--tsconfig", "worker/tsconfig.json", "worker/src/index.ts"]
