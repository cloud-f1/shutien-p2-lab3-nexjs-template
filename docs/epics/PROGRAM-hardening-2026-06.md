# Program roster — Hardening + Next.js cleanup (2026-06, Phases 64–65)

Confirmed epics from three audits (billing, API↔schema, FastAPI-doc) + user decisions.
Each is a branch/PR; this is the single source of program status (EPIC_INDEX rows are
added per-epic as they merge, to avoid cross-branch conflicts).

## Phase 64 — Data + billing hardening

| Epic | Scope | Status |
|---|---|---|
| **E273** | CRUD modals + reusable DataTable convention + Next.js domain scaffold (P1a) | ✅ merged (#18) |
| **E274** | **Billing completion** — E274a JSON-configurable pricing + checkout wired ✅ (PR #19). Remaining: plan-id→UUID FK fix, idempotent webhook upsert (uses E275 UNIQUE), `currentPeriodEnd`, cancel-subscription UI, real `reconcile()`, ECPay renewal cron, route-handler tests | 🔄 E274a done; money-path ⬜ |
| **E275** | **Schema hardening** — split `schema.ts` → `lib/schema/{auth,items,billing,system}` + barrel; migration 0006 (composite PKs, UNIQUEs, FK/lookup indexes) | ✅ done (this PR) |
| **E276** | **API consistency/correctness** — `deleteUser` audit log; billing→`requireAuth`+繁中; https-only webhooks + max-length validation; transactional `acceptInvitation`; single shared billing-enum source; return-shape consistency; `webhook_deliveries.status`/`audit_log` enums + `updatedAt` on mutated system tables | ⬜ |

## Phase 65 — FastAPI → Next.js doc/tooling cleanup

(Leave history untouched; delete dead-stack code; phased PRs — all user-confirmed.)

| Epic | Scope | Status |
|---|---|---|
| **E277** | **Agent brain** — reconceive `/athena:dba`→drizzle-kit & `/athena:audit`→Drizzle/Zod/UI drift; de-stale 9 agents + 9 commands. (Dead-stack skills removed ✅ PR #21) | ✅ done (feat/E277-agent-brain) |
| **E278** | **Onboarding/dev docs** — rewrite guides / dev-guide / techstack / diagrams / CONTRIBUTING / PRD / dev-docs to Next.js; delete removed-subsystem docs (openapi-patterns, sre-observability, ci-explained) | ⬜ |
| **E279** | **Delete dead-stack code** — `docs/examples/**` (52 FastAPI+Vite) + `docs/openapi/` + leftover FastAPI templates | ⬜ |
| **E280** | **Stale scripts/config** — fix/remove `scripts/{new-site,doctor,deploy-cloudrun,tutorial,verify-pg,migration-review}` + hooks + `.pre-commit`/`.husky`/`.dockerignore`; Makefile legacy targets | ⬜ |

## Execution order

E275 (done) → **merge open PRs to stabilise `main`** → E274 money-path → E276 → E277 → E278 → E279 → E280.

> ⚠️ Open PRs awaiting merge: #17 (make), #19 (E274a), #20 (memory-refresh), #21 (P1b skills),
> + this E275 PR. Merging them first prevents EPIC_INDEX/CLAUDE.md cross-branch conflicts as the
> remaining epics land.
