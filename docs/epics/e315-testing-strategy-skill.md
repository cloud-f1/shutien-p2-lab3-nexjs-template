# E315 — Testing-Strategy Skill

> Phase 73 · quality · toolchain
> Status: ⬜ pending

## Problem

The template has a working test suite (Vitest unit + Playwright e2e) but no codified guidance on *how* to test: what layer handles what, what traps exist, how to grow the middle layer without over-testing. The `ai-rc-engineer-pm` downstream project discovered three hard traps through real failures:

1. **Orphan-tested function** — a pure function with full unit coverage but never imported by any Server Action (tested but not wired in; the feature silently doesn't work in prod).
2. **Conditional-skip flaky e2e** — a test that skips via `test.skip(condition)` instead of failing, making CI green while the feature is broken for that condition.
3. **Integration harness ordering** — dynamic `import()` of actions AFTER `DATABASE_URL` is set (at the throwaway DB) is critical; a top-level static import reads the URL at module-load time, pointing at the dev DB instead.

These traps are non-obvious and easy to repeat. The `testing-strategy` skill codifies the pyramid shape, the "few but precise" rule, and all three traps so every future test author (and every fork team) avoids re-discovering them.

## Solution

1. **`testing-strategy` skill** (`SKILL.md`) — port from rc-engineer-pm; adapt to template's test setup (email-based auth, standard admin/editor/viewer roles, simpler domain). Remove RC-specific harness helpers (`seedCaseFixtures`, `readCase`, `countAuditRows` etc.); keep the pattern (throwaway-DB + `afterEach truncate` + dynamic import after `DATABASE_URL` set). Adapt trap examples to template's items/billing/api-keys domain.
2. **`docs/dev-guide/testing.md`** update — cross-reference the `testing-strategy` skill; add the three traps as a "Known Traps" section if not already there.

## Key Files

- `.claude/skills/testing-strategy/SKILL.md` (NEW)
- `docs/dev-guide/testing.md` — add Known Traps section + skill cross-reference

## Implementation

### Phase 1 — Port + adapt skill
- Port `testing-strategy/SKILL.md` from rc-engineer-pm.
- **Adapt**: replace 瑞成-specific content:
  - Trap 4 "orphan-tested function" → use a template example (e.g. `exportItems` utility that was unit-tested but never called from the export Server Action).
  - Trap 5 "conditional-skip" → use a template example (e2e TOTP flow that conditionally skips when 2FA not enabled).
  - Integration harness → adapt to template's `next-app/test/int/harness.ts` (if present) or describe the pattern without the RC-specific helpers.
  - Remove: test counts (`~463 unit · 4 component · 9 integration · 35 e2e`) → generic guidance only.
  - Remove: RC-specific `seedCaseFixtures`, `seedUser`, `readAuditRows` helpers → generic pattern.
- Keep: pyramid shape, "few but precise" rule, the three traps (orphan + conditional-skip + harness ordering), Vitest vs Playwright split, "every new Server Action ships with ≥1 integration test" rule.

### Phase 2 — Dev-guide update
- Read `docs/dev-guide/testing.md`; add:
  - A "Known Traps" section with brief descriptions of all 3 traps + link to `testing-strategy` skill.
  - A "Pyramid shape" note (unit ≥70% floor, not target; middle layer for wiring bugs).
- Do NOT rewrite the whole file — additive only.

## Acceptance Criteria

- [ ] `.claude/skills/testing-strategy/SKILL.md` exists; no rc-specific content (no 瑞成, no R#####, no RC-specific helpers)
- [ ] All 3 traps documented with a concrete template-domain example
- [ ] `docs/dev-guide/testing.md` has a "Known Traps" section referencing the skill
- [ ] `pnpm typecheck && pnpm lint` clean

## Cross-Epic

- E316 (scripts tooling) — `staleness-check.sh` would flag if `testing.md` hasn't been touched since a big test suite change

## Out of Scope

- Adding the integration harness itself (if not present) — that's a separate quality epic
- Adding `pnpm test:int` script — only the skill guidance is in scope here
- Enforcing "every new Server Action ships with ≥1 integration test" via CI — guidance only
