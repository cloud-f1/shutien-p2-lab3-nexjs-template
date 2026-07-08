# E321 — Test Pyramid Middle Layer + QA Process

> Phase 75 · quality · backport-wave-2
> Status: ⬜ pending
> Source: fork E303 (integration harness + component tests) + `docs/qa/` process
> ⚠️ Run **in-repo** (adds devDeps + a throwaway-DB harness — not worktree-safe)

## Problem

The template's test shape is an **hourglass**: many Vitest unit tests + Playwright e2e, but **no middle layer**. Two whole bug classes fall through:

1. **Wiring bugs** — a Server Action + its pure helpers each unit-test green, but the action never calls the helper, or calls it with the wrong DB context. Only an integration test (real Server Action → real throwaway DB) catches this.
2. **Component-contract bugs** — a form/dialog renders wrong props, mis-wires `onSuccess`, or breaks a11y — invisible to unit tests, expensive to catch in full e2e.

The fork closed this with E303: a throwaway-DB integration harness (`pnpm test:int`) + a jsdom/RTL component layer, and formalized a `docs/qa/` process (pyramid audit + a versioned manual-test-plan that annotates which suites automation already covers, so humans don't re-test them).

## Solution

1. **Integration harness → `pnpm test:int`.** Port the throwaway-DB pattern: spin an ephemeral Postgres (or a disposable schema), set `DATABASE_URL` **before** any dynamic `import()` of actions (top-level static import reads the URL at module-load → points at dev DB — the documented ordering trap), `afterEach` truncate, run real Server Actions against it. Ship ~2–3 flagship integration tests (e.g. an items CRUD action + a billing/reconcile action) as the reference pattern.
2. **Component-test layer.** Add `@testing-library/react` + `@testing-library/dom` + `@testing-library/jest-dom` + `@testing-library/user-event` + `jsdom`. Ship ~2 reference component tests (a Dialog form with `onSuccess`, a DataTable filter) so forks have a copyable pattern.
3. **`docs/qa/` process scaffold.**
   - `docs/qa/test-strategy.md` — pyramid-audit template: quantify current unit/component/integration/e2e counts + %, diagnose shape, list a small T1–Tn augmentation table each locking one zero-coverage risk.
   - `docs/qa/manual-test-plan/` — a versioned checkbox-Markdown human acceptance suite (README index + S-suites + a dated `test-results-YYYY-MM-DD.md`), scoped to what automation *can't/shouldn't* cover (time-dependent, live-role UX, human judgment), each suite annotated "🤖 automation-covered" where applicable.

## Key Files

- `next-app/test/int/harness.ts` (NEW) + `next-app/test/int/*.int.test.ts` (NEW, ~2–3)
- `next-app/test/component/*.test.tsx` (NEW, ~2)
- `next-app/package.json` — add `test:int` script + `@testing-library/*` + `jsdom` devDeps
- `next-app/vitest.config.ts` — jsdom environment for component tests (project split or env override)
- `docs/qa/test-strategy.md` (NEW)
- `docs/qa/manual-test-plan/README.md` + `S1-*.md` + `test-results-<date>.md` (NEW)

Reference (fork, read-only): `../ai-rc-engineer-pm/next-app/test/`, `../ai-rc-engineer-pm/docs/qa/`

## Implementation

### Phase 1 — integration harness
- Port the harness; document the `DATABASE_URL`-before-import ordering inline.
- Write 2–3 integration tests against template domains (items CRUD, billing reconcile, RBAC guard rejection).

### Phase 2 — component layer
- Add TL deps + jsdom; configure vitest (separate `component` project or `environmentMatchGlobs`).
- Write 2 reference component tests.

### Phase 3 — QA docs
- Write `test-strategy.md` with the template's real current counts.
- Scaffold `manual-test-plan/` with the README index + 1–2 example S-suites + the automation-coverage annotation convention. (Template content, not 瑞成's S1–S10.)

## Acceptance Criteria

- [ ] `pnpm test:int` runs against a throwaway DB and passes; harness sets `DATABASE_URL` before dynamic import
- [ ] ≥2 integration tests + ≥2 component tests, all green
- [ ] `pnpm test` (unit) + `pnpm test:e2e` still pass; component tests don't leak into the unit run (or are intentionally included)
- [ ] `docs/qa/test-strategy.md` quantifies the current pyramid + lists augmentation targets
- [ ] `docs/qa/manual-test-plan/` scaffold with README + automation-coverage annotation
- [ ] `pnpm typecheck && pnpm lint` clean

## Cross-Epic

- E316 (Phase 73, testing-strategy skill) — this builds the harness the skill only *describes*; update the skill's "harness ordering" trap to point at the real `test/int/harness.ts`
- E320 — orphan/wiring guards + integration tests together kill the wiring-bug class
- E322 — `make verify` + CI should run `test:int`

## Out of Scope

- The fork's 瑞成 domain fixtures (`seedCaseFixtures`, case/node/prereq helpers) — template uses items/billing/users
- 100% middle-layer coverage — reference pattern + flagship tests only ("few but precise")
- The fork's exact S1–S10 manual suite *content* — scaffold + convention only
