<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Completion and deployment

After any task that changes code, configuration, or schema is fully implemented and verified, commit only the task-related changes, push every affected repository, update and push the parent submodule pointer when applicable, and run `./scripts/db-migrate.sh` to apply all pending SQL and Graphile Worker migrations. Do not report completion until the pushes and migrations succeed; report any permission, credential, network, or policy blocker explicitly.
