# E177 — Accessibility Audit Sweep (axe-core zero-violations baseline)

> Phase 44 — Design System Completion & Validation | Size: S (3 SP) | Deps: E167, E168, E169, E173, E174, E175

## Problem

The framework claims a11y throughout — `<nav aria-label="Breadcrumb">`, `aria-current="page"` on active nav, `aria-label` on icon-only buttons, focus management in Modal/Drawer (E174). But:

- `@axe-core/playwright` is wired (E130) but **never run against the new primitives**.
- No automated check that `<DataTable>` has correct table semantics (`role="table"`, `<th scope="col">`).
- No automated check that focus trap in `<Modal>` / `<Drawer>` (E174) actually traps.
- No screen-reader smoke test that `<Toast>` announces to assistive tech (`aria-live="polite"`).
- No contrast-ratio check across the 6 themes — `rose` and `forest` were palette-spiked but never run through WCAG AA contrast.

Result: we say "a11y-first" but have zero proof. Next a11y review surfaces violations we missed.

## Solution

Build a Playwright a11y test that runs `@axe-core` against every primitive in isolation and every migrated page, then enforces zero violations as a CI gate.

### Coverage

| Surface | Test |
|---|---|
| **Primitives in isolation** | Render each primitive with realistic props on a stub page; run axe; assert zero violations |
| **Migrated pages** | For each route (`/`, `/signin`, `/signup`, `/dashboard/*`, `/privacy`, `/terms`, `/404`), navigate, run axe, assert zero violations |
| **Modal / Drawer interaction** (E174) | Open modal, run axe, assert focus is trapped, ESC closes, focus returns |
| **Contrast across themes** | For each theme (dark, indigo, navy, sage, rose, forest), run axe contrast check on `/dashboard/sessions` (representative page) |
| **Keyboard navigation** | Tab through `/dashboard/sessions`, assert tab order is logical (skip-nav → topbar → first nav item → main content) |

### Tooling

- `@axe-core/playwright` — already in `package.json`.
- One new spec file `client/e2e/a11y.spec.ts` driving the matrix.
- Failures dump the axe report to a clear message including selector + violation rule URL.
- CI job: `pnpm test:e2e --project=a11y`.

## Key Files

| File | Action |
|---|---|
| `client/e2e/a11y.spec.ts` | New — main a11y spec |
| `client/e2e/helpers/a11y-runner.ts` | New — axe.run() wrapper with project-tuned config (e.g. exclude third-party iframes) |
| `client/e2e/fixtures/primitive-pages/` | New — minimal stub pages that render each primitive in isolation for the per-primitive matrix |
| `client/playwright.config.ts` | Edit — add `a11y` project (Chromium, no VRT, no auth setup) |
| `.github/workflows/ci.yml` (or equivalent) | Edit — add a11y job; fail PR on any violation |
| `docs/design/design.md` | Edit — § 8 testing extended with "Accessibility coverage"; § 10 anti-patterns table adds "uses `aria-hidden` on a focusable element" |
| `docs/guides/en/accessibility.md` | New — contributor guide: how to run a11y locally, how to debug a violation, common fixes. **Deferred at E177 closeout (see `A11Y_BASELINE.md`); the fork-author extension guide shipped in E215** (`docs/guides/{en,zh-TW}/accessibility.md`). |

## Implementation

1. Author `a11y-runner.ts` — wraps `await new AxeBuilder({ page }).analyze()` with our config (rules to enable/disable per WCAG level).
2. Author primitive stub pages: 1 stub per primitive (e.g. `/__a11y__/datatable`, `/__a11y__/modal`). Mount only in dev/test builds via a feature flag so production routing is untouched.
3. Author `a11y.spec.ts` matrix:
   - 50+ primitive specs (one per `components/ui/` component — count grows as Phase 44 ships E173/E174/E175/E178)
   - 14 page specs (every public + auth + dashboard route)
   - 6 theme contrast specs
4. Run locally; fix any violations found. Common ones to expect:
   - Insufficient color contrast in `text-text-muted` against `bg-surface` on light themes
   - Missing `aria-label` on icon-only buttons (some legacy spots)
   - Form inputs without associated `<label>` (caught by `<FormField>` if used; legacy auth pages may have stragglers)
   - `<Toast>` lacking `role="alert"` or `aria-live="polite"`
5. Wire CI job; ensure PR fails when a violation is introduced.
6. Author the contributor guide (`accessibility.md`) — recipes for the most likely violations.

## Acceptance Criteria

- [ ] `a11y.spec.ts` matrix passes locally with zero violations
- [ ] CI job runs the a11y matrix on every PR; fails on any violation
- [ ] All primitives in `components/ui/` covered by an isolation test (count ≈ 50+ after Phase 44 ships; matrix auto-driven by `fs.readdirSync` so new primitives are picked up without spec edits)
- [ ] All 14 migrated pages covered by a route-level test
- [ ] All 6 themes pass WCAG AA contrast on the representative dashboard page
- [ ] Modal / Drawer focus-trap and ESC behavior verified by interaction test
- [ ] Toast announce-to-screen-reader verified via `aria-live` assertion
- [ ] Keyboard tab order verified on the dashboard
- [ ] `docs/guides/en/accessibility.md` contributor guide written
- [ ] design.md § 8 extended; CI badge for a11y coverage if practical

## Alignment / Cross-Epic Hooks

- **Soft-depends on E167–E169 + E173–E175** — sweep makes most sense after every primitive ships and every page is migrated.
- **Hard-depends on E130** (axe-core scaffold) — uses the existing dependency.
- **Pairs with E171** (Playwright VRT) — same Playwright infrastructure; both run as separate CI projects.
- **Pairs with E172** (i18n) — translated `aria-label` text is a real win for non-EN screen-reader users.
- **Closes the "we claim a11y" gap** with proof.

## Out of Scope

- **Manual screen-reader testing** with NVDA / JAWS / VoiceOver — separate human-gated step; the contributor guide explains how.
- **Cognitive a11y** (reading-level, attention, memory) — outside axe-core scope.
- **A11y for the Markdown content** in `<Prose>` (Privacy/Terms) — Prose primitive itself is tested; content authoring is a different concern.
- **WCAG AAA contrast** — AA is the bar; AAA blocks too many palette choices.
- **A11y for third-party widgets** (e.g. Sentry feedback widget if added later) — out of scope.
- **Automated remediation** — find + flag, don't auto-fix.
