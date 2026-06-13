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

Next.js requires real secret values — placeholder secrets cause auth failures.

```bash
# Verify these are NOT default/placeholder values in Zeabur (or your platform):
# AUTH_SECRET          — must be a random 32+ char secret (Auth.js v5)
# DATABASE_URL         — must point to a real PostgreSQL database, not localhost
# NEXTAUTH_URL         — must be the actual deployed app URL (if required by Auth.js)
```

### Gate 2: Migrations are current (Critical)

```bash
# Verify Drizzle migrations are applied
cd next-app && pnpm db:migrate
# Should output "No pending migrations" or apply cleanly
```

Apply any pending migrations against the target DB before deploying application code.

### Gate 3: Test coverage gate (Critical)

```bash
# Unit tests — must pass
cd next-app && pnpm test -- --run

# E2E tests — must pass
cd next-app && pnpm test:e2e
```

Both suites must be green. A red test suite blocks deployment.

### Gate 4: Required env vars are present (Critical)

| Var | Where set | Notes |
|-----|-----------|-------|
| `DATABASE_URL` | Zeabur / platform | `postgresql://...` format (postgres-js, not asyncpg) |
| `AUTH_SECRET` | Zeabur / platform | Random secret for Auth.js v5 |
| `NEXTAUTH_URL` | Zeabur / platform | Full deployed URL e.g. `https://myapp.zeabur.app` |
| `NEXT_PUBLIC_*` | Zeabur / platform | Baked at build time — set before triggering build |

### Gate 5: Build is green (Critical)

```bash
# TypeScript compiles cleanly
cd next-app && pnpm typecheck

# Next.js production build succeeds
cd next-app && pnpm build
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

### Gate 7: Auth flow works end-to-end (Critical)

```bash
# After deploy, verify login works against target environment
APP="https://your-app.zeabur.app"
curl -sf "$APP/api/auth/session" | jq .
# Must return session JSON or empty object — not a 500 error
```

Manual check: open the app URL, attempt login with a seed account, verify dashboard loads.

### Gate 8: Database + demo accounts work (Critical)

```bash
# Verify seed data is present (run once after first deploy)
cd next-app && pnpm db:seed
# Then verify login works (manual or via Playwright)
```

Seed accounts are defined in `next-app/drizzle/seed.ts` — check that file for credentials.

### Gate 9: Visual consistency (Critical)

| Page | Route | What to verify |
|------|-------|----------------|
| Landing | `/` | Design tokens applied, consistent typography, dark mode works |
| Sign In | `/login` | Auth layout, branding correct |
| Sign Up | `/register` | Same as sign in |
| Dashboard | `/dashboard` | Sidebar, correct layout, no hydration mismatch |

```bash
# Check key layout components exist in the right pages
grep -r "ThemeProvider" next-app/components/ --include="*.tsx" | head -5
```

### Gate 10: Branding assets exist (Critical)

```bash
ls -la next-app/public/favicon.ico next-app/public/favicon.png 2>/dev/null
ls -la next-app/public/logo.svg 2>/dev/null
```

| Item | File | What to check |
|------|------|---------------|
| Browser tab icon | `public/favicon.ico` / `public/favicon.png` | Shows project logo |
| SVG logo | `public/logo.svg` | Used by logo component |
| OG image | `next-app/app/layout.tsx` metadata | `openGraph.images` points to valid asset |
| Page title | `next-app/app/layout.tsx` metadata | Correct `title` and `description` |

### Gate 11: No stale Docker builds (Critical, if using Docker)

If deploying via Docker image, verify the image was rebuilt after the latest commit.

```bash
git log -1 --format=%ci
docker inspect --format='{{.Created}}' $(docker ps -qf name=app) 2>/dev/null
# If git commit is newer → rebuild needed
```

### Gate 12: Local smoke test passes (Critical)

```bash
cd next-app && pnpm build && pnpm start
# Visit http://localhost:3000 — app should load without errors
# Check browser console for errors
```

### Gate 13: SEO meta tags (Advisory)

```bash
grep -rn "metadata" next-app/app/layout.tsx
grep -rn "generateMetadata" next-app/app/ --include="*.tsx" | head -10
```

### Gate 14: Performance baseline (Advisory)

```bash
cd next-app && pnpm build 2>&1 | grep -E "chunk|route|Page"
# Check for routes >500KB — consider dynamic imports if found
```

### Gate 15: Rate limiting verification (Advisory)

Verify that authentication endpoints have appropriate rate limiting configured
(via Next.js middleware, platform-level WAF, or Auth.js built-in protections).

---

## Generic Launch Gate Summary

| # | Check | Type |
|---|-------|------|
| 1 | Secrets are not placeholders | Critical |
| 2 | Migrations are current | Critical |
| 3 | Tests pass | Critical |
| 4 | Required env vars present | Critical |
| 5 | Build green (TS + Next.js bundle) | Critical |
| 6 | Working tree clean + correct branch | Critical |
| 7 | Auth flow works end-to-end | Critical |
| 8 | Database + demo accounts work | Critical |
| 9 | Visual consistency across pages | Critical |
| 10 | Branding assets present | Critical |
| 11 | No stale Docker builds (if applicable) | Critical |
| 12 | Local smoke test passes | Critical |
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
Image: [app_image]:[tag]
Gates: tests ✓ / tsc ✓ / build ✓ / git ✓ / branch ✓
Status: success
Health: HTTP 200 — [response time]ms
Domain: [app_domain]
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
gcloud artifacts docker tags list "$REGISTRY/dev-app/$(jq -r '.gcr.app_image' deploy/config.json)"
```

### SOP: Status Check

```bash
# 1. Show config
jq '.' deploy/config.json

# 2. Check GCR images (single Next.js app image)
REGISTRY=$(jq -r '.gcr.registry' deploy/config.json)
gcloud artifacts docker tags list "$REGISTRY/dev-app/$(jq -r '.gcr.app_image' deploy/config.json)"

# 3. Health check
APP_DOMAIN=$(jq -r '.environments.dev.app_domain' deploy/config.json)
curl -sf "https://$APP_DOMAIN/api/health" | jq .

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

1. Reads `deploy/config.json` for registry, image names, and env vars
2. Detects which files changed — only rebuilds when `next-app/**` has changes
3. Authenticates to GCP via `GCP_SERVICE_ACCOUNT` secret
4. Builds single `linux/amd64` Next.js app image and pushes to GCR
5. Branch determines environment: `main` → dev, `prd` → prd

### GCR / Zeabur File Map

| File | Role |
|------|------|
| `deploy/config.json` | Single source of truth — all settings |
| `deploy/docker-push.sh` | Local: build amd64 image & push to GCR |
| `deploy/deploy-zeabur.sh` | Interactive: Zeabur deploy with env vars, domains |
| `deploy/zeabur-update.sh` | Push template definition changes to Zeabur |
| `deploy/zeabur-template.yaml` | Zeabur service topology (PG + Next.js app) |
| `deploy/README.md` | Human-readable deploy documentation |
| `.github/workflows/docker-publish.yml` | CI: auto build on push to main/prd |
| `.github/workflows/ci.yml` | CI: tests + coverage gates |

### Troubleshooting (GCR / Zeabur)

**Health check fails after deploy:**
The Next.js app runs Drizzle migrations on startup (if configured). If PostgreSQL isn't ready,
the DB connection fails. Check DB connectivity and the `DATABASE_URL` env var in Zeabur.

**405 Method Not Allowed on API routes:**
The `NEXTAUTH_URL` may be misconfigured. Verify it matches the deployed app URL exactly.
It's baked at build time — fix it in Zeabur env vars, trigger a new build, and redeploy.

**Auth redirect loop:**
`NEXTAUTH_URL` or `AUTH_SECRET` is missing or wrong. Check Zeabur env vars and trigger rebuild.

**Orbstack domains (Mac):**
When using Orbstack for local dev, the app runs at `https://<project-name>.orb.local`.
Set `NEXTAUTH_URL` to this URL in your local `.env.local`.

**Port already allocated:**
```bash
PORT=3001 docker compose up --build -d
```

**ARM image crashes on Zeabur:**
Mac builds ARM images by default. `docker-push.sh` forces `--platform linux/amd64`.
Rebuild with the script if you built manually.

**Images pushed but Zeabur still shows old version:**
Zeabur doesn't auto-pull on image update for PREBUILT services. Trigger a redeploy
from the dashboard or run `bash deploy/deploy-zeabur.sh --redeploy`.
