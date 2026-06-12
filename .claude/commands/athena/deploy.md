---
description: "(ops) Deploy to Zeabur → 7 pre-deploy gates → blocks on any failure."
allowed-tools: Bash, Read
---
Invoke @deployer with target environment: $ARGUMENTS (default: production)
After: agent writes to docs/context/deploy-log.md

## Environment routing (E159)

`/athena:deploy` accepts these environments:

| Argument | Zeabur target | Required env | Notes |
|----------|---------------|--------------|-------|
| `production` (default) | Production service IDs (server + client) | `ENVIRONMENT=production`, `SENTRY_DSN_SERVER`, `VITE_SENTRY_DSN`, `GIT_SHA`, `VITE_GIT_SHA` | Migration review (E157) MUST be green against the staging snapshot first. |
| `staging` | Staging service IDs (server + client, sibling project of prod on Zeabur) | `ENVIRONMENT=staging`, `SENTRY_DSN_SERVER` (optional but recommended), `GIT_SHA` | Used as the migration-review canary before production. |

**Conventions for the staging Zeabur project:**

- One project `ai-coding-template-staging` mirroring the production project,
  with its own PostgreSQL add-on. Service IDs live in
  `docs/context/deploy-log.md` for the deployer agent to look up.
- Same `Dockerfile` / `zbpack.json` — only the env vars change.
- Staging emits to its own Sentry environment (`environment=staging`) so
  prod alerts stay clean.
- Staging is the only place E157 migration-review SQL is executed before
  production: the deployer must verify the migration ran cleanly in
  staging before flipping production.

If `staging` is invoked and the staging service IDs are unset, the deployer
exits with a clear setup-needed message rather than guessing the target.
