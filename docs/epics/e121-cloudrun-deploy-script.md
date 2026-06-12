# E121 — Cloud Run Deploy Script (Interactive)

> Phase 32 — Two-Way Deploy | Size: M | Deps: E120, E122
> Beginner-first: guided interactive script matching deploy-zeabur.sh UX

## Problem

Cloud Run deployment requires 10+ `gcloud` commands, easy for beginners to miss one. The existing `deploy-zeabur.sh` is a guided interactive script with gates, prompts, and error handling. Cloud Run needs the same DX — not a raw command list, but an interactive script that walks beginners through each step.

## Solution

Create `scripts/deploy-cloudrun.sh` with the same gate structure as `deploy-zeabur.sh`:

```
Gate 0: Prerequisites (gcloud CLI, Docker, authenticated, project set, APIs enabled)
Gate 1: Git status (branch, uncommitted changes)
Gate 2: Database setup (Cloud SQL OR external free-tier — user chooses)
         - Cloud SQL: create instance, DB, user (guided)
         - External: prompt for connection string (Neon/Supabase/other)
Gate 3: Secrets (SECRET_KEY, REFRESH_SECRET_KEY → Secret Manager or env vars)
Gate 4: Build + Push images (docker build → Artifact Registry)
Gate 5: Deploy services (server with DB connection, client with VITE_API_URL)
Gate 6: Domain setup (default *.run.app or custom domain)
Gate 7: Verification (health check, service URLs)
```

### Modes (matching deploy-zeabur.sh):
- `--first-time`: Full guided setup
- `--redeploy`: Rebuild + redeploy existing services
- `--status`: Show current Cloud Run service status
- `--env-only`: Update env vars / secrets without redeploying

### Free-Tier Path (beginner-friendly):
When user chooses database at Gate 2, offer:
```
Database options:
  1. Cloud SQL PostgreSQL (~$7/mo — managed, easiest)
  2. External PostgreSQL (Neon/Supabase — free tier available)
  3. I already have a DATABASE_URL

Choice [1/2/3]:
```

## Key Files

| File | Action |
|------|--------|
| `scripts/deploy-cloudrun.sh` | New — interactive Cloud Run deploy script |
| `Makefile` | Already handled by E123 (platform selector) |

## Acceptance Criteria

1. `bash scripts/deploy-cloudrun.sh --first-time` walks through all 8 gates interactively
2. Each gate has clear prompts, colored output, and "Fix:" hints on failure
3. Database gate offers Cloud SQL (managed) OR external free-tier PG (Neon/Supabase)
4. Secrets stored in Secret Manager (recommended) or plain env vars (simpler)
5. Images built locally and pushed to Artifact Registry
6. Health check verification: `curl $SERVICE_URL/health` → HTTP 200
7. `--redeploy` mode rebuilds and redeploys without re-running setup gates
8. `--status` shows service URLs, revision, scaling config
9. Script is idempotent — safe to re-run if interrupted
