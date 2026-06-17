# AI App Template — Session Summary
> **Tier 1 Project Memory** · Load this to resume any session without re-explaining context.

---

## Latest Session — 2026-06-16 (Phases 63–68 — hardening + fork-ability + production)
Branch: `main` @ `25dabef`. The E274–E293 program is fully merged (PRs #19/#22/#24–#42 across the phases; see EPIC_INDEX).

### Shipped
- **Phase 63–64 — Data/billing hardening**: E274 billing money-path (plan-id→UUID FK fix, `currentPeriodEnd`, cancel-subscription UI, real `reconcile()`, ECPay renewal cron, SQLSTATE-23505 idempotent upsert; #27 — E274a JSON-configurable pricing + checkout shipped earlier #19) · E275 schema split `lib/schema.ts` → `lib/schema/{auth,items,billing,system}` + barrel, migration 0006 composite PKs/UNIQUEs/indexes (#22) · E276 API consistency: deleteUser audit log, billing requireAuth+繁中, https-only webhooks, transactional acceptInvitation, shared billing-enum source (#24).
- **Phase 65 — FastAPI→Next.js cleanup**: E277 agent-brain reconceive (`/athena:dba`→drizzle-kit, `/athena:audit`→Drizzle/Zod/UI drift, de-staled 9 agents + 9 commands; #26) · E278 onboarding/dev docs rewritten to Next.js (#28) · E279 deleted dead FastAPI+Vite worked examples + templates (#25) · E280 removed 33 dead-stack files, rewrote Makefile Next.js-only, fixed `.pre-commit`/`.dockerignore`/pre-deploy-guard (#29).
- **Phase 66 — AI-dev trust**: E281 generated OpenAPI contract from Zod (`@asteasolutions/zod-to-openapi`) + `/api/openapi` + coverage guard + smoke drift-gate (#30) · E282 rewrote `stop-verifier.sh` for `next-app/` (8 Next.js rules, was 23 dead FastAPI/Vite rules) + refreshed `scripts/hooks/CLAUDE.md` + `dba-migrations.md` (#31) · E283 restored `/athena:domain` as a copy-from-items generator (`scripts/new-domain.sh` + `make new-domain`; #32).
- **Phase 67 — Fork-ability**: E284 de-footgun `@saas` registry install (guarded install-landing, `SAAS_REGISTRY_URL`, drift warnings, homepage → cloud-f1; #38) · E285 one-knob rebrand (`NEXT_PUBLIC_APP_NAME`/`lib/branding.ts`) + root metadata + logo inline-style fix + demo-login hardening + engines pin (#39) · E286 fork guide rewritten to Next.js, README → `docs/guides/` (#33) · E287 single-service `deploy-zeabur.sh`, Dockerfile `NEXT_PUBLIC_APP_URL` ARG, GCP migrate/seed via builder image + correct seed path (#42).
- **Phase 68 — Production hardening**: E288 GitHub Actions CI (`.github/workflows/ci.yml`; #34) · E289 HTTP security headers + CSP on all routes (`lib/security-headers.ts` + `next.config.ts`; #35) · E290 password-reset flow + invite emails, migration 0007 `password_reset_tokens` (#40) · E291 public REST API via `api_keys` (`app/api/v1/items`, `verifyApiKey` + scopes), registered in the E281 OpenAPI contract (#36) · E292 billing e2e + Stripe Customer Portal (`createPortalSession` + Manage-billing button; #37) · E293 baseline observability — `instrumentation.ts` + env-gated Sentry + `lib/logger.ts`, `lib/audit.ts` logs failures (#41).

### Current state
- **~327 unit tests green** · migrations through **0007** · `main` @ **25dabef**. typecheck + lint + build green.
- **Run locally:** `docker compose up --build -d` → http://localhost:3000 (Mailpit :8025). Logins: admin@/editor@/viewer@example.com (Admin123!/Editor123!/Viewer123!).

### Open / next
- **CI auto-trigger** — a follow-up (PR #43) disables `.github/workflows/ci.yml`'s auto-trigger to manual-only; merge #43 or disable the workflow via the Actions UI.
- **Release tag** — program complete; suggest tagging `v0.3.0` (agent can't push tags/main).

---

## Latest Session — 2026-06-15 (Phases 58–62 shipped → v0.2.0 + polish)
Branch: `main` @ `488a034` (#16). Merge order on main: #11 (P58) → #12 (P59) → #14 (P60+P61) → #15 (P62) → #16 (polish).

### Shipped
- **Phase 58 — AI-Ready Modular SaaS** (#11): shadcn `@saas` registry (`registry.json` → `public/r/*.json`) + `module-author` / `install-*` skills + `module.manifest.json` spec + `PaymentProvider` abstraction (Stripe **default** + 綠界 ECPay 定期定額) + `@saas/landing` + MCP. Migration 0004.
- **Phase 59 — Deployment Enablement** (#12): Zeabur (`zbpack.json`) + **GCP Cloud Run + Cloud SQL** runbooks + `.env.example` + `deploy-config` skill + `install-deploy-tools.sh`.
- **Phases 60–61 — Cobalt design** (#14): oklch tokens + FX layer (`cobalt-fx.css`) + landing redesign + dashboard polish + ⌘K palette + notifications dropdown + breadcrumb + tabbed settings + auth split-screen + `/dashboard/components`. Playwright VRT gate.
- **Phase 62 — Backend SaaS surfaces** (#15, migration 0005): API keys (E267) · webhooks + deliveries (E268) · audit log (E269) · team invites + permission matrix + member status (E270) · billing UI (E271) · notifications (E272). Owner/admin RBAC; pure logic in db-free `*-utils` modules.
- **Polish** (#16): landing → full 繁體中文 · `make local*` targets · dashboard left-alignment · logo mark + favicon (`components/logo.tsx`, `app/icon.svg`, `favicon.ico`, `apple-icon.png`).
- **v0.2.0**: `CHANGELOG.md` `[0.2.0]` + `next-app/package.json` bump + `docs/releases/v0.2.0.md`.

### Fixes this session
- **API-key parse bug** (`fix(E267)`): greedy prefix split mis-parsed base64url secrets → valid keys rejected intermittently. Prefix now hex; surfaced by the coverage run, not `pnpm test`.
- **Fresh-DB migration gate**: `pnpm db:test-migrate` (`drizzle/test-migrate.ts`) applies all migrations to a throwaway DB + asserts tables; wired into `make smoke`.
- **Enriched seed**: `pnpm db:seed` now populates billing/api-keys/webhooks/audit/invites/notifications/items (idempotent).
- **`make local-db` env**: drizzle-kit/tsx don't read `.env.local` → targets now source it + tolerate an already-migrated DB (PR #17, pending).

### Current state
- **232 unit tests green** · coverage **80.7% stmts** (db-free layer; `vitest.config` scoped off db-bound `actions/**`) · Playwright e2e + VRT · typecheck + lint (0 err) + build all green.
- **Run locally:** `make local-setup` once → `make local` → http://localhost:3000 (Mailpit :8025). Or `docker compose up --build -d`. Logins: admin@/editor@/viewer@example.com (Admin123!/Editor123!/Viewer123!).
- **Local dev env:** host `pnpm dev` reads `next-app/.env.local` (gitignored). Recommendation: single `docker-compose` + `.env.local`, not a dev/prod compose split.

### Open / next
- **PR #17** (`fix/make-local-db-env`) — Makefile `.env.local` sourcing fix — awaiting merge.
- **v0.2.0 tag + GitHub release** — after #17: `git tag -a v0.2.0 && git push origin v0.2.0` + `gh release create v0.2.0 --notes-file docs/releases/v0.2.0.md` (user-run; agent can't push tags/main or merge PRs).
- Intentionally English: `/dashboard/components` storybook + the "Webhooks" tab (tech terms).

---

## Stack quick reference (Next.js)
```
Stack: Next.js 16 (App Router) + React 19 + TS + Tailwind v4 + shadcn/ui + Drizzle/Postgres + Auth.js v5 (JWT)
Pipeline: spec → implement → qa → commit → merge (QA before commit)
Auth: Credentials REQUIRES JWT sessions (DrizzleAdapter DB-sessions break login); RBAC guards re-read role from DB
Path alias: @/* → next-app/ root. Default Server Components; "use server" actions; pure logic → *-utils.ts (db-free, unit-tested)
DB: drizzle/migrations/*.sql + meta/_journal.json; `pnpm db:test-migrate` verifies fresh-DB apply; seed is dev-only (refuses prod)
Billing: PaymentProvider abstraction — BILLING_PROVIDER=stripe|ecpay; @saas/billing-{stripe,ecpay} modules
Gates: scripts/smoke.sh [--vrt] · scripts/pre-merge-check.sh [--e2e]
Skills: nextjs-saas-patterns (stack gotchas) · athena-loop-speedups (orchestration)
Constraints: agent can't push to main / merge PRs / push tags — user does those; user-facing copy in 繁體中文
```
<!-- last activity:  at 2026-06-16T13:04:17Z -->
