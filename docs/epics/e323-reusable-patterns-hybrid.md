# E323 — Reusable Patterns (Hybrid: bake-in primitives + @saas modules)

> Phase 75 · architecture · backport-wave-2
> Source: fork E304 (`defineAction`), `components/rc/rc-modal`, ui primitives, scheduler/audit/RBAC/Sentry patterns
> ⚠️ Run **in-repo** (adds shadcn components + deps — not worktree-safe)
> Status: ⬜ pending

## Decision (confirmed 2026-07-08)

**Hybrid.** Bake the broadly-useful primitives into the base template; package the heavier, domain-adjacent patterns as **optional `@saas` registry modules** (the template already ships `@saas/billing-stripe`, `@saas/landing` — the clean home for opt-in infra). This keeps the base lean while making every pattern reachable.

## Problem

The fork produced reusable patterns the template lacks. Some are near-universal for a Next.js SaaS (a Server-Action factory, a responsive modal, date pickers); others are valuable but not every fork needs them (a cron scheduler, immutable audit log, row-level RBAC visibility, Sentry). Baking all of them in would bloat the base and ship infra every fork carries whether or not they use it.

## Solution

### Part A — Bake into base template

1. **`defineAction` factory** (`next-app/lib/define-action.ts`) — one cross-cutting Server-Action pipeline: **guard → Zod validate → authorize → handler → audit → revalidate**. Eliminates per-file `guard()` duplication + the "forgot to audit" class. Generalize the fork's `getLiveRole()`/`can(role,flag)` to the template's `lib/is-admin.ts` / role helpers. Add **stop-verifier recognition** so `defineAction(` counts as a valid RBAC guard (else factory-only files false-positive — coordinate with E319's guard-family widening).
2. **Responsive `rc-modal`** (`next-app/components/responsive-modal.tsx`) — Dialog on desktop, bottom-Sheet on mobile. Rename from `rc-` to a template-neutral name. Fits the CRUD-modal convention.
3. **shadcn primitives** — `calendar.tsx` + `date-picker.tsx` (backing `react-day-picker` + `date-fns`) + `textarea.tsx` if missing. Add via `npx shadcn@latest add` where possible, not hand-authored.
4. **`mobile-tab-bar.tsx`** — fixed bottom mobile nav (<768px), role-filtered, safe-area aware. Generalize nav items to the template's routes. (Carry the fork's `z-index` lesson: tab bar must sit *below* modal footers — `z-40`, not `z-100`.)
5. **`ui-spec-epic.md`** surface-contract epic template (`docs/epics/_templates/`) — machine-readable route/nav/tabs/sections/deepLinks/rbac YAML block that `/athena:align` + `surface-check.cjs` diff against the build.

### Part B — Author as optional `@saas` modules (manifest + install skill each)

6. **`@saas/scheduler`** — in-process `node-cron` worker (`instrumentation.ts` `register()`, nodejs-runtime-only, `started` guard, try/catch-wrapped handler, env-overridable cadence + TZ). Deliberately chosen over an HTTP cron endpoint.
7. **`@saas/audit-log`** — legal-grade immutable audit table: append-only, denormalized actor snapshot, `beforeValue`/`afterValue` jsonb, `targetLabel`; `log()` records the real actor even for act-on-behalf-of.
8. **`@saas/rbac-scoped-visibility`** — assignment-scoped row-level visibility (a role sees only assigned rows; live role re-read server-side). Pairs with `defineAction`'s authorize hook.
9. **`@saas/observability-sentry`** — `@sentry/nextjs` wiring + PII scrubbing (`lib/sentry-scrub.ts`), env-gated no-op when DSN unset; `SENTRY_AUTH_TOKEN` absent → build still succeeds.
10. **`@saas/csv-io`** — `toCsv`/`escapeCsvCell` export + generic CSV import (upsert-by-key, per-row errors, row cap) + a bulk-user-import dialog reference.

> Each module ships `module.manifest.json` (deps/env/db) + a paired `install-*` consumer skill (per the `module-author` skill). No base-template code change to install.

## Key Files

**Base (Part A):**
- `next-app/lib/define-action.ts` (NEW) + `scripts/hooks/stop-verifier.sh` (recognize `defineAction(`)
- `next-app/components/responsive-modal.tsx` (NEW), `components/ui/{calendar,date-picker,textarea}.tsx`, `components/mobile-tab-bar.tsx` (NEW)
- `next-app/package.json` — `react-day-picker`, `date-fns`
- `docs/epics/_templates/ui-spec-epic.md` (NEW)

**Modules (Part B)** — under the registry (`registry/@saas/<name>/` or wherever the existing modules live), each with `module.manifest.json` + `install-<name>` skill.

Reference (fork, read-only): `../ai-rc-engineer-pm/next-app/lib/define-action.ts`, `.../components/rc/rc-modal.tsx`, `.../components/rc/mobile-tab-bar.tsx`, `.../lib/{scheduler-worker,rc-audit,sentry-scrub,export-utils,users-csv-utils}.ts`, `.../instrumentation.ts`

## Implementation

### Phase 1 — base primitives
- Port `defineAction`; adapt guard/authorize to template role helpers; add ≥1 unit + ≥1 integration test (ties to E321). Update stop-verifier + fixtures.
- Add `responsive-modal`, `calendar`/`date-picker`/`textarea`, `mobile-tab-bar` (template-neutral names + routes).
- Add `ui-spec-epic.md` template.

### Phase 2 — first module (scheduler) as reference
- Author `@saas/scheduler` fully (manifest + install skill + code) as the pattern-setter.

### Phase 3 — remaining modules
- Author `@saas/audit-log`, `rbac-scoped-visibility`, `observability-sentry`, `csv-io` following the module-author skill. (Can be split into follow-up epics if scope runs long — see Out of Scope.)

## Acceptance Criteria

- [ ] `lib/define-action.ts` exists; ≥1 Server Action migrated to it as reference; unit + integration test green; stop-verifier recognizes `defineAction(` (fixture proves it)
- [ ] `responsive-modal` renders Dialog≥768px / Sheet<768px; `calendar`+`date-picker` added via shadcn; `mobile-tab-bar` respects safe-area + sits below modal footers
- [ ] `react-day-picker` + `date-fns` in package.json; `pnpm typecheck && pnpm lint && pnpm build` clean
- [ ] `docs/epics/_templates/ui-spec-epic.md` exists with the Surface-contract YAML block
- [ ] `@saas/scheduler` installs cleanly via its skill into a test project (manifest valid, env documented)
- [ ] ≥1 additional module authored (audit-log) with manifest + install skill; remaining modules either authored or split to a tracked follow-up epic
- [ ] No 瑞成/rc-/繁中-domain literals in base or module code (patterns only)

## Cross-Epic

- E319 — guard-family widening; this adds `defineAction` recognition specifically
- E321 — `defineAction`'s audit/authorize path is the ideal integration-test target
- E320 — new base modules must pass `check:orphans` (be wired, not orphaned)
- `module-author` skill — governs Part B module structure

## Out of Scope

- 瑞成 domain code (cases/nodes/schedule-engine/gantt/badge-login/繁中 enums)
- The fork's traffic-light `light.tsx`, gantt geometry, new-case wizard — product-specific
- If Part B runs long: authoring all 5 modules in one epic — acceptable to ship scheduler + audit-log here and split `rbac-scoped-visibility` / `observability-sentry` / `csv-io` into a follow-up epic (E324) rather than bloat this one
