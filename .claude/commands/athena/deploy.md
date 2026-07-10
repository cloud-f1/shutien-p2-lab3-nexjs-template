---
description: "(ops) Deploy to Zeabur → 7 pre-deploy gates → blocks on any failure."
allowed-tools: Bash, Read
---
Invoke @deployer with target environment: $ARGUMENTS (default: production)
After: agent writes to docs/context/deploy-log.md

## Stack (E159, updated for the Next.js single-service migration)

This template is **one Next.js service** (`next-app/`), not the old two-service
Vite/FastAPI split. There is no `SENTRY_DSN_SERVER` / `VITE_SENTRY_DSN` pair and no
separate server + client service IDs — one `next-app` service, one env set.

### Env — know which bucket a var is in before debugging "why didn't it take effect"

**Runtime env** (read at request time by the server — toggle per-service/env with
**no rebuild**):

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Postgres connection string |
| `AUTH_SECRET` | Auth.js v5 JWT signing secret |
| `SENTRY_DSN` | Server-side error reporting; unset → `instrumentation.ts` is a no-op |

**Build-time env** (`NEXT_PUBLIC_*` — baked into the JS bundle; changing them in the
host dashboard has **no effect until the next build/deploy**):

| Var | Purpose |
|-----|---------|
| `NEXT_PUBLIC_APP_NAME` | Branding source (`lib/branding.ts`) |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL used in emails/links |
| `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` | Shows/hides the demo-login button — `false` for stg/prd |

### Reference material

- `deploy/deploy-zeabur.sh` + `deploy/config.json` — the interactive Road 1 (Zeabur)
  deploy script and its service/env config (service name, root, port, `build_args`,
  `runtime_env`).
- **`deploy-config` skill** — walks the preflight gate + env wiring for both roads.
- **`zeabur-deploy` skill** — headless, server-targeted Zeabur CLI flow (project +
  Postgres + web service + domain + env + migrate + seed + verify); use for a fresh
  cloud instance or `deploy <server-name>`.
- **Road 2 — GCP**: `make deploy-gcp` + `docs/guides/deployment-gcp.md` (Cloud Run +
  Cloud SQL). Use when `$ARGUMENTS` names a GCP/Road-2 target instead of Zeabur.

## Environment routing

| Argument | Target | Notes |
|----------|--------|-------|
| `production` (default) | Zeabur production `next-app` service | Road 1. Migration should already be exercised on staging first. |
| `staging` | Zeabur staging `next-app` service (sibling project) | Canary env before production; own Postgres add-on; same `Dockerfile`/`zbpack.json`, only env vars differ; `SENTRY_DSN` (if set) should report `environment=staging` so prod alerts stay clean. |
| `gcp` / `road2` | Cloud Run + Cloud SQL | Delegate to `make deploy-gcp`; see `docs/guides/deployment-gcp.md`. |

If `staging` is invoked and the staging service isn't configured yet, the deployer
exits with a clear setup-needed message rather than guessing the target.

## 7-Gate Protocol (self-contained — mirrors `.claude/agents/deployer.md`; read that file for the authoritative source, do not edit it from here)

All commands run from `next-app/` unless noted. Exit 2 = BLOCKED on any gate failure —
@deployer never deploys with a failing gate.

```
Gate 1: pnpm test:coverage           (Vitest db-free layer, >= 80%)
Gate 2: pnpm typecheck               (tsc --noEmit)
Gate 3: pnpm lint                    (eslint-config-next)
Gate 4: pnpm build                   (production build succeeds)
Gate 5: pnpm db:test-migrate         (fresh-DB migration apply)
Gate 6: git status --porcelain = empty  AND  branch = main or develop
Gate 7: pnpm test:e2e                (Playwright e2e — dashboard smoke)
```

## Deployment Steps

1. Read `docs/context/deploy-log.md` — last deploy state, rollback target.
2. Run all 7 gates — stop on ANY failure, report which gate blocked.
3. **Human handoff (pull-only GitHub perms)**: this agent cannot push to or merge
   `main`. Once all 7 gates are green:
   - Report to the user: gate results, the commit SHA to be deployed, and the target
     environment.
   - **STOP** — the USER pushes/merges to `main` (or the deploy branch). Zeabur's
     git-triggered build fires on that push; this command does not push on the
     user's behalf.
4. After the user confirms the push/merge landed: health check `curl /health` on the
   target URL → expect HTTP 200.
5. Verify migration version matches the expected latest Drizzle migration.
6. Write-back → `docs/context/deploy-log.md`.

## Write-Back Format

```markdown
### [timestamp] — [env] deploy
Commit: [SHA] | Migration: [latest drizzle migration]
Gates: coverage / typecheck / lint / build / migrate / git+branch / e2e-smoke [pass/fail each]
Status: success / failed at gate N / awaiting user push
Health: HTTP [code] — [response time]ms
Previous working commit: [SHA] (rollback target)
```

## Rollback

If health check fails after deploy:
1. `git revert HEAD` (or identify the previous working commit from deploy-log.md).
2. Report the revert to the user — they push it (same pull-only handoff as Step 3).
3. Log the rollback in `docs/context/deploy-log.md`.

## Rules

- NEVER deploy if any of the 7 gates fail.
- NEVER push or merge to `main`/deploy branch directly — report gates-green and hand
  off to the user (pull-only GitHub perms).
- ALWAYS read `deploy-log.md` first for previous state and rollback target.
- ALWAYS verify health after a deploy the user confirms landed.
- ALWAYS record the rollback target commit.
