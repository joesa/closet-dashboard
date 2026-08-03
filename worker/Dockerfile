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

# npm run worker -> tsx --tsconfig worker/tsconfig.json worker/src/index.ts
# Run as the node user rather than root; /app is only ever read at runtime.
USER node

CMD ["npm", "run", "worker"]
