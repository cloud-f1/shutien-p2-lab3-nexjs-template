# E325 — Remaining @saas Modules (rbac-scoped-visibility · sentry-pii · csv-io)

> Phase 76 · architecture · follow-up to E323
> Status: ⬜ pending

## Problem

E323 delivered the Hybrid split's first two `@saas` modules (`scheduler`, `audit-log`) and deferred three more to keep that PR focused. These are the remaining opt-in patterns from the fork worth packaging.

## Solution

Author three `@saas` registry modules (each: `next-app/registry/<name>/` + `module.manifest.json` declaring deps/env/db + a paired `install-<name>` skill under `.claude/skills/`, following `module-author` and the existing `scheduler`/`audit-log` modules). Generalize — no 瑞成/rc/繁中-domain literals.

1. **`@saas/rbac-scoped-visibility`** — assignment-scoped row-level visibility: a role sees only rows assigned to it; live role re-read server-side. Composes with `defineAction`'s `authorize` hook (E323). Provide the pure filter helper + an M:N assignment table pattern + wiring notes.
2. **`@saas/sentry-pii`** — a PII-scrubbing layer for the template's existing env-gated Sentry (E293): a `beforeSend` scrubber (`lib/sentry-scrub.ts`) that masks emails / tokens / ID-like strings, env-gated no-op when `SENTRY_DSN` unset. Install skill documents composing with the existing `instrumentation.ts` (do NOT duplicate Sentry init).
3. **`@saas/csv-io`** — `toCsv`/`escapeCsvCell` export helpers + a generic CSV import (upsert-by-key, per-row errors, row cap) + a reference bulk-import dialog. Generalize the fork's `export-utils`/`users-csv-utils`.

Register each in the registry index (`next-app/registry.json` + emitted `public/r/*.json` via `registry:build`).

## Key Files
- `next-app/registry/{rbac-scoped-visibility,sentry-pii,csv-io}/**` + `module.manifest.json` each
- `.claude/skills/install-{rbac-scoped-visibility,sentry-pii,csv-io}/SKILL.md`
- `next-app/registry.json`, `next-app/public/r/*.json`

## Acceptance Criteria
- [ ] 3 modules authored; `pnpm module:validate` all valid; `pnpm registry:build` emits their JSON
- [ ] Each has a paired `install-*` skill with correct deps/env/db + compose-don't-clobber notes (esp. sentry-pii vs existing instrumentation.ts)
- [ ] Base template `pnpm typecheck && pnpm lint && pnpm build` stay green (registry/ is base-typechecked — keep opt-in deps behind dynamic/relative imports, per the E323 pattern)
- [ ] No domain literals

## Cross-Epic
- E323 — same Hybrid module pattern; rbac-scoped-visibility pairs with the `defineAction` authorize hook
- E293 — sentry-pii layers onto the existing env-gated Sentry, not a second init

## Out of Scope
- Wiring any module live into the base template (they're opt-in installs)
- Orphan remediation → E324
