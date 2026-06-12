---
name: deploy-readiness
description: >
  Deploy and launch readiness skill. Use this skill when the user mentions deploying,
  launching, shipping, or checking if the app is ready for production. Trigger phrases:
  "deploy", "launch", "is it ready to ship", "pre-deploy", "release readiness",
  "ship it", "push to dev/prd", "is it ready", "go live checklist", "final review",
  "check everything before deploy", "launch check", "ready to launch", "pre-launch",
  "check status", "what's deployed". This skill has two tiers: generic gates (always
  apply to any fork) and owner-specific GCR/Zeabur steps (original author's stack only).
---

# Deploy & Launch Readiness

This skill covers the full deploy lifecycle: pre-deploy gates, launch readiness checks,
and deployment execution. It is organized into two clearly-labelled tiers.

> **Fork note:** The **Generic Gates** section (Tier 1) applies to every fork of this
> template. The **"This repo's deploy stack"** section (Tier 2) is the original
> author's GCR + Zeabur SOP — if you forked this template, replace Tier 2 with your
> own platform's deployment steps.

---

## Tier 1 — Generic Gates (fork-safe, always applies)

These checks must pass before any deployment, regardless of target platform.
All gates are blockers unless marked Advisory.

### Gate 1: Secrets are not placeholders (Critical)

Server requires real secret values — placeholder secrets cause auth failures.

```bash
# Verify these are NOT default/placeholder values:
# SECRET_KEY          — must be random 64-char hex
# REFRESH_SECRET_KEY  — must be random 64-char hex, different from SECRET_KEY
# DATABASE_URL        — must point to a real database, not localhost
# ALLOWED_ORIGINS_STR — must list actual client domain(s)
```

Rule: `SECRET_KEY` and `REFRESH_SECRET_KEY` must never be the same value.

### Gate 2: Migrations are current (Critical)

```bash
# Verify no pending migrations exist
cd server && uv run alembic current
uv run alembic heads
# Both should show the same revision
```

If a migration gap exists, run `alembic upgrade head` against the target DB
before deploying application code.

### Gate 3: Test coverage gate (Critical)

```bash
# Server tests — must pass with >=80% coverage
cd server && uv run python -m pytest tests/ -v --cov=app --cov-fail-under=80

# Client tests — must pass with >=80% coverage
cd client && pnpm test:coverage
```

Both suites must be green. A red test suite blocks deployment.

### Gate 4: Required env vars are present (Critical)

| Var | Where set | Notes |
|-----|-----------|-------|
| `DATABASE_URL` | Server | `postgresql+asyncpg://...` format |
| `SECRET_KEY` | Server | 64-char hex |
| `REFRESH_SECRET_KEY` | Server | 64-char hex, different from SECRET_KEY |
| `ALLOWED_ORIGINS_STR` | Server | Comma-separated list of client domains (no trailing slash, no wildcards) |
| `ENVIRONMENT` | Server | `production` or `staging` |
| `VITE_API_URL` | Client build | Must point to API domain, not client domain — baked at build time |

Observability vars (required in production):
- `SENTRY_DSN_SERVER` — server crashes. Missing in production = startup failure.
- `VITE_SENTRY_DSN` + `VITE_GIT_SHA` — client. Missing = `console.warn` (no crash).

### Gate 5: Build is green (Critical)

```bash
# TypeScript compiles cleanly
cd client && pnpm run typecheck

# OpenAPI spec is valid
npx @redocly/cli lint docs/openapi.yaml

# Client production build succeeds
cd client && pnpm build
# Watch for abnormally large chunks (>500KB warning)
```

### Gate 6: Working tree is clean (Critical)

```bash
# No uncommitted changes
test -z "$(git status --porcelain)" || echo "FAIL: dirty working tree"

# On correct branch
BRANCH=$(git branch --show-current)
[[ "$BRANCH" == "main" || "$BRANCH" == "develop" ]] || echo "FAIL: branch is $BRANCH"
```

### Gate 7: CORS configuration is aligned (Critical)

CORS origins must match exactly across all config locations. A mismatch causes login failures.

```bash
grep -n "ALLOWED_ORIGINS" \
  server/app/core/config.py \
  docker-compose.yml
# All should list the same client domain(s)
```

Rules:
- Include protocol: `https://your-app.example.com`
- No trailing slash
- No wildcards — FastAPI CORS does not support wildcards in `allow_origins`

### Gate 8: Database + demo accounts work (Critical)

```bash
# Verify login works against target environment
API="http://localhost:${SERVER_PORT:-8080}"
curl -sf -X POST "$API/auth/jwt/login" \
  -d "username=admin@test.com&password=Admin%23Pass1" \
  -H "Content-Type: application/x-www-form-urlencoded" | jq .access_token
# Must return a JWT, not an error
```

Seed accounts: `admin@test.com` / `Admin#Pass1` (superuser), `user@test.com` / `User#Pass1`.

### Gate 9: Visual consistency (Critical)

| Page | Route | What to verify |
|------|-------|----------------|
| Landing | `/` | Design tokens applied, consistent typography |
| Sign In | `/signin` | AuthLayout, branding correct |
| Sign Up | `/signup` | Same as sign in |
| Dashboard | `/dashboard` | DashboardLayout, sidebar, 8 views |
| Privacy | `/privacy` | LegalLayout, no dark theme leakage |
| Terms | `/terms` | LegalLayout, no dark theme leakage |
| Forgot Password | `/forgot-password` | Consistent with auth pages |
| Verify Email | `/verify-email` | Loading/success/error states |

```bash
# Auth pages use AuthLayout
grep "AuthLayout" client/src/pages/auth/SignInPage.tsx
# Legal pages use LegalLayout
grep "LegalLayout" client/src/pages/legal/PrivacyPage.tsx
# Dashboard uses DashboardLayout
grep "DashboardLayout" client/src/pages/dashboard/DashboardPage.tsx
```

### Gate 10: Branding assets exist (Critical)

```bash
ls -la client/public/favicon.ico client/public/favicon.png
ls -la client/public/logo.svg client/public/logo-192.png client/public/logo-512.png
cat client/public/manifest.json | jq '.name, .short_name, .theme_color'
```

| Item | File | What to check |
|------|------|---------------|
| Browser tab icon | `favicon.ico` / `favicon.png` | Shows project logo |
| PWA icon | `logo-192.png`, `logo-512.png` | Correct branding |
| SVG logo | `logo.svg` | Used by `LogoMark` component |
| Manifest name | `manifest.json` | Correct app name |
| OG image | `index.html` meta tags | `og:image` points to valid asset (must be absolute URL) |
| Page title | `index.html` | Correct title |

### Gate 11: No stale Docker builds (Critical)

Docker containers serve compiled assets. Editing CSS/JS without rebuilding serves the old version.

```bash
# Compare last git commit time vs container creation time
git log -1 --format=%ci
docker inspect --format='{{.Created}}' $(docker ps -qf name=client) 2>/dev/null
# If git commit is newer → rebuild needed
```

### Gate 12: Docker local smoke test passes (Critical)

Run before pushing to any registry. Catches CORS mismatches, port conflicts, and auth issues.

```bash
# Use alternate ports — defaults (5432, 8080, 3000) are often occupied by local dev
DB_PORT=5434 SERVER_PORT=8082 CLIENT_PORT=3001 \
  docker compose up --build -d

sleep 15
docker compose ps  # all 3 should show "Up" + "healthy"

# Health check
curl -sf http://localhost:8082/health | jq .
# Expect: {"status":"healthy","version":"...","database":"connected"}

# Auth flow
curl -sf -X POST "http://localhost:8082/auth/jwt/login" \
  -d "username=admin@test.com&password=Admin#Pass1" \
  -H "Content-Type: application/x-www-form-urlencoded" | jq .access_token

# Client serves HTML
curl -sf -o /dev/null -w "HTTP %{http_code}" "http://localhost:3001/"
# Expect: HTTP 200

# Cleanup
DB_PORT=5434 SERVER_PORT=8082 CLIENT_PORT=3001 docker compose down
```

### Gate 13: SEO meta tags (Advisory)

```bash
grep -E "title>|og:|description|theme-color" client/index.html

# Seo component is used on pages
grep -rn "<Seo" client/src/pages/ --include="*.tsx" | head -10
```

### Gate 14: Performance baseline (Advisory)

```bash
cd client && pnpm build 2>&1 | tail -20
# Check for chunks >500KB — consider code-splitting if found
```

### Gate 15: Rate limiting verification (Advisory)

```bash
API="https://your-api-domain.example.com"
# Auth endpoint should be rate-limited (5/minute by default)
for i in $(seq 1 6); do
  curl -s -o /dev/null -w "%{http_code} " -X POST "$API/auth/jwt/login" \
    -d "username=wrong@example.com&password=wrong" \
    -H "Content-Type: application/x-www-form-urlencoded"
done
echo ""
# Should see 200s then 429 (rate limited)
```

---

## Generic Launch Gate Summary

| # | Check | Type |
|---|-------|------|
| 1 | Secrets are not placeholders | Critical |
| 2 | Migrations are current | Critical |
| 3 | Tests pass (>=80% coverage) | Critical |
| 4 | Required env vars present | Critical |
| 5 | Build green (TS + OpenAPI + bundle) | Critical |
| 6 | Working tree clean + correct branch | Critical |
| 7 | CORS configuration aligned | Critical |
| 8 | Database + demo accounts work | Critical |
| 9 | Visual consistency across pages | Critical |
| 10 | Branding assets present | Critical |
| 11 | No stale Docker builds | Critical |
| 12 | Docker local smoke test passes | Critical |
| 13 | SEO meta tags correct | Advisory |
| 14 | Bundle size within bounds | Advisory |
| 15 | Rate limiting active | Advisory |

**Rule**: All Critical checks must pass before deployment. Advisory checks are logged but do not block.

---

## Tier 2 — This repo's deploy stack (customize for your fork)

> **FORK NOTICE:** If you forked this template, **replace this entire section** with your
> own platform's deployment steps. The steps below are the original author's GCR + Zeabur
> SOP and will not apply to your deployment. Only the Tier 1 Generic Gates above are
> universal.

This section covers the original author's deployment pipeline: Docker images pushed to
Google Artifact Registry (GCR), served via Zeabur. Every setting lives in
`deploy/config.json` — read it first, never hardcode values.

### Config: Single source of truth

```bash
# Quick lookups
jq -r '.gcr.registry' deploy/config.json                    # GCR registry
jq -r '.gcr.server_image' deploy/config.json                # server image name
jq -r '.environments.dev.api_domain' deploy/config.json     # dev API domain
jq -r '.environments.dev.vite_api_url' deploy/config.json   # dev VITE_API_URL
jq -r '.zeabur.template_id' deploy/config.json              # Zeabur template ID
```

The config drives: `docker-push.sh`, `zeabur-update.sh`, and `.github/workflows/docker-publish.yml`.

### Decision: Which SOP Do I Follow?

| User intent | SOP |
|-------------|-----|
| "Deploy" / "ship it" | → Full Deploy (below) |
| "Push images" / "build docker" | → Docker Build & Push only |
| "Update template" | → Template Update only |
| "Check status" | → Status Check |
| "Change domain" / "rename images" | → Config Change |
| First deploy / new environment | → First-Time Setup |
| Health check failing / CORS / 405 | → Troubleshooting |

### SOP: Full Deploy

Environment is `dev` by default; pass `prd` for production.

```bash
# 1. Read config and previous state
cat deploy/config.json | jq .
cat docs/context/deploy-log.md | tail -30

# 2. Run Tier 1 Generic Gates (all must pass — stop on any failure)

# 3. Build & push Docker images
bash deploy/docker-push.sh        # dev
bash deploy/docker-push.sh prd    # production

# 4. Update Zeabur template (if template yaml changed)
bash deploy/zeabur-update.sh

# 5. Deploy on Zeabur
bash deploy/deploy-zeabur.sh --redeploy   # existing project

# 6. Health check
API_DOMAIN=$(jq -r '.environments.dev.api_domain' deploy/config.json)
curl -sf "https://$API_DOMAIN/health" | jq .
# Expect: {"status": "healthy"} with HTTP 200
# Retry up to 3 times with 10s delay (server runs Alembic migrations on startup)
```

### 7. Write back to deploy log

```markdown
### [timestamp] — [env] deploy
Commit: [SHA] | Migration: v[NNN]
Images: [server_image]:[tag] / [client_image]:[tag]
Gates: server ✓ / client ✓ / openapi ✓ / tsc ✓ / git ✓ / branch ✓
Status: success
Health: HTTP 200 — [response time]ms
Domain: [api_domain] / [client_domain]
Previous working commit: [SHA] (rollback target)
```

### SOP: Docker Build & Push Only

```bash
# Verify images will be tagged correctly
jq '.gcr, .environments.dev' deploy/config.json

# Build and push
bash deploy/docker-push.sh        # dev
bash deploy/docker-push.sh prd    # production

# Verify they landed
REGISTRY=$(jq -r '.gcr.registry' deploy/config.json)
gcloud artifacts docker tags list "$REGISTRY/dev-app/$(jq -r '.gcr.server_image' deploy/config.json)"
gcloud artifacts docker tags list "$REGISTRY/dev-app/$(jq -r '.gcr.client_image' deploy/config.json)"
```

### SOP: Status Check

```bash
# 1. Show config
jq '.' deploy/config.json

# 2. Check GCR images
REGISTRY=$(jq -r '.gcr.registry' deploy/config.json)
gcloud artifacts docker tags list "$REGISTRY/dev-app/$(jq -r '.gcr.server_image' deploy/config.json)"
gcloud artifacts docker tags list "$REGISTRY/dev-app/$(jq -r '.gcr.client_image' deploy/config.json)"

# 3. Health check
API_DOMAIN=$(jq -r '.environments.dev.api_domain' deploy/config.json)
curl -sf "https://$API_DOMAIN/health" | jq .

# 4. Zeabur status
npx zeabur service list
npx zeabur domain list

# 5. Last deploy log entry
tail -20 docs/context/deploy-log.md
```

### SOP: Config Change

1. Edit `deploy/config.json` — the single change point
2. Update `deploy/zeabur-template.yaml` if it references hardcoded values
3. Push template update: `bash deploy/zeabur-update.sh`
4. Rebuild images with new names: `bash deploy/docker-push.sh`
5. Update `deploy/README.md` quick reference if needed

### SOP: First-Time Setup

```bash
# Prerequisites
gcloud auth list                    # GCP CLI authenticated
docker buildx version               # Docker buildx available
npx zeabur version                  # Zeabur CLI installed
npx zeabur auth status              # Zeabur authenticated
```

Required secrets:

| Where | Secret | What it is |
|-------|--------|------------|
| GitHub repo settings | `GCP_SERVICE_ACCOUNT` | GCP service account JSON — CI uses it to push images |
| Zeabur project | `GCR_JSON_KEY` | Same JSON key — Zeabur uses it to pull private images |

```bash
# 1. Create GCR repos (skip if they exist)
gcloud artifacts repositories create dev-app --repository-format=docker --location=asia-east1
gcloud artifacts repositories create prd-app --repository-format=docker --location=asia-east1

# 2. Add GCP_SERVICE_ACCOUNT to GitHub → Settings → Secrets

# 3. Build & push first images
bash deploy/docker-push.sh

# 4. Create Zeabur template
npx zeabur template create -f deploy/zeabur-template.yaml
# → Returns template ID — save it to deploy/config.json

# 5. Update config with template ID
# Edit deploy/config.json → zeabur.template_id

# 6. Interactive Zeabur deploy
bash deploy/deploy-zeabur.sh --first-time

# 7. Set GCR_JSON_KEY in Zeabur dashboard for image pulling
```

### CI/CD: Automated Deploys

`.github/workflows/docker-publish.yml` runs on push to `main` or `prd`:

1. Reads `deploy/config.json` for registry, image names, and VITE_API_URL
2. `dorny/paths-filter` detects which services changed (`server/**` or `client/**`)
3. Only changed services are built — saves ~3 min per CI run
4. Authenticates to GCP via `GCP_SERVICE_ACCOUNT` secret
5. Builds `linux/amd64` images and pushes to GCR
6. Branch determines environment: `main` → dev, `prd` → prd

### GCR / Zeabur File Map

| File | Role |
|------|------|
| `deploy/config.json` | Single source of truth — all settings |
| `deploy/docker-push.sh` | Local: build amd64 images & push to GCR |
| `deploy/deploy-zeabur.sh` | Interactive: 6-gate Zeabur deploy with env vars, domains |
| `deploy/zeabur-update.sh` | Push template definition changes to Zeabur |
| `deploy/zeabur-template.yaml` | Zeabur service topology (PG + server + client) |
| `deploy/README.md` | Human-readable deploy documentation |
| `.github/workflows/docker-publish.yml` | CI: auto build on push to main/prd |
| `.github/workflows/ci.yml` | CI: tests + coverage gates |

### Troubleshooting (GCR / Zeabur)

**Health check fails after deploy:**
Server runs `alembic upgrade head` before starting uvicorn. If PostgreSQL isn't ready,
migrations fail. The Dockerfile retries 5 times with 5s delays. If it still fails,
check DB connectivity and the `DATABASE_URL` env var in Zeabur.

**405 Method Not Allowed on login:**
`VITE_API_URL` is pointing to the client domain instead of the API domain. It's baked at
Docker build time — fix it in `config.json`, rebuild the client image, and redeploy.

**CORS errors in browser:**
`ALLOWED_ORIGINS_STR` doesn't include the client domain. Set it to the exact client URL
(e.g., `https://dev-coding-template.zeabur.app`). No wildcards.

**Orbstack domains (Mac):**
When using Orbstack for local dev, the client runs at
`https://client.<project-name>.orb.local`. This URL must appear exactly in
`ALLOWED_ORIGINS_STR`. Check all locations:
```bash
grep -n "ALLOWED_ORIGINS" server/app/core/config.py .env.local server/.env docker-compose.yml
```

**Stale CORS after project rename:**
```bash
grep -rn "old-project-name" docker-compose.yml .env.local server/.env server/app/core/config.py
```

**Port already allocated:**
```bash
DB_PORT=5434 SERVER_PORT=8082 CLIENT_PORT=3001 docker compose up --build -d
```

**ARM image crashes on Zeabur:**
Mac builds ARM images by default. `docker-push.sh` forces `--platform linux/amd64`.
Rebuild with the script if you built manually.

**Images pushed but Zeabur still shows old version:**
Zeabur doesn't auto-pull on image update for PREBUILT services. Trigger a redeploy
from the dashboard or run `bash deploy/deploy-zeabur.sh --redeploy`.
