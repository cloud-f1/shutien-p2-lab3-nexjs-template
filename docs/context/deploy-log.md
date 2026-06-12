# Deploy Log — @deployer
> **Tier 1 Project Memory** · Owner: `@deployer`  
> Updated on each `/athena:deploy` run.

---

## Current Production State

| Service | Platform | Status | Domain | Migration |
|---|---|---|---|---|
| Server (FastAPI) | Zeabur | ⬜ Not provisioned | — | — |
| Client (React) | Zeabur | ⬜ Not provisioned | — | — |
| PostgreSQL | Zeabur addon | ⬜ Not provisioned | — | — |

**Next deploy: First deploy ever** — server + client + DB must all be provisioned together.
Last verified: 2026-03-30

---

## Pre-Deploy Gate Checklist

All 6 must pass before any deploy. `@deployer` exits 2 (BLOCKED) if any fails.

```
☐ 1. Server tests:  cd server && pytest --cov=app --cov-fail-under=80 -q
☐ 2. Client tests:  cd client && pnpm run test:run -- --coverage
☐ 3. OpenAPI lint:  npx @redocly/cli lint docs/openapi.yaml
☐ 4. TypeScript:    cd client && pnpm run typecheck
☐ 5. Git clean:     git status --porcelain = empty
☐ 6. Branch:        git branch --show-current = main (production) or develop (staging)
```

---

## Zeabur First-Deploy Runbook

> Run this sequence when deploying for the first time.

### Step 1: Zeabur Project Setup
```bash
# In Zeabur dashboard:
# 1. New Project → "AI-Coding-Template"
# 2. Add service: Deploy from GitHub → select repo → path: server/
# 3. Add service: Deploy from GitHub → select repo → path: client/
# 4. Add addon: PostgreSQL → note the connection string
```

### Step 2: Environment Variables

**Server service:**
```
SECRET_KEY=<generate: python -c "import secrets; print(secrets.token_urlsafe(64))">
DATABASE_URL=<from Zeabur PostgreSQL addon>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
ALLOWED_ORIGINS=https://<client-domain>.zeabur.app
DEBUG=false
SMTP_HOST=<email provider>
SMTP_PORT=587
SMTP_USER=<email>
SMTP_PASSWORD=<password>
SERVER_DOMAIN=https://<server-domain>.zeabur.app
```

**Client service — MUST SET BEFORE BUILD:**
```
VITE_API_URL=https://<server-domain>.zeabur.app
```
⚠️ `VITE_API_URL` is baked into the JS bundle at build time.  
Setting it after the first build requires a **rebuild** — not just a restart.

### Step 3: Deploy Order
```
1. Deploy server → wait for health: GET /health → 200
2. Confirm DB migration ran: GET /health → { "database": { "migration_version": "..." } }
3. Deploy client → wait for nginx: GET / → 200
4. Smoke test: POST /auth/register with test account
```

---

## Known Deploy Gotchas

| Gotcha | Symptom | Fix |
|---|---|---|
| `VITE_API_URL` after build | Client calls wrong API URL | Set env var BEFORE first build; rebuild if changed |
| Migration not applied | 500 errors, missing columns | Check server startup logs; run `alembic upgrade head` manually via Zeabur shell |
| CORS error | Client gets CORS blocked | Verify `ALLOWED_ORIGINS` matches exact client domain (no trailing slash) |
| DB connection refused | Server 500 on first request | Check `DATABASE_URL` format: `postgresql+asyncpg://user:pass@host/db` |
| Cold start timeout | First request takes 30s+ | Zeabur: set minimum instances to 1 (not 0) |

---

## Completed Deploys

*(none yet — entries appear here after each deploy)*

<!-- Template:
## deployer — [ISO timestamp]
Branch: [branch] | Environment: [staging | production]

### Gate Results
| Gate | Status | Detail |
|------|--------|--------|
| Server tests | ✅/❌ | X% coverage |
| Client tests | ✅/❌ | X% coverage |
| OpenAPI lint | ✅/❌ | — |
| TypeScript | ✅/❌ | — |
| Git clean | ✅/❌ | — |
| Branch | ✅/❌ | [name] |

### Deploy Result
Commit: [SHA] | Pipeline: [GH Actions URL] | Health: HTTP [status] [ms]
Migration version in prod: [version]

### Current State
[DEPLOYED ✅] or [BLOCKED ❌ — reason]

### Promote?
[GENERALIZABLE / PROJECT-SPECIFIC]
-->
