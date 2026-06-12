# E171 — Playwright Visual Regression Coverage for the Design System

> Phase 43 — Universal Design System Adoption | Size: M (5 SP) | Deps: E167, E168, E169

## Problem

The design system spans two axes — **theme** (6 variants × 47 CSS vars) and **preset** (`default` / `compact` / brand-custom). The matrix is **6 × 2 = 12** rendered combinations per page, multiplied by ~14 pages = **168 surfaces** that could regress.

Today:
- Behavior is covered by Vitest (338 tests) — search, pagination, row actions, form validation, etc.
- Visuals are NOT covered — no automated check that `data-theme="rose"` actually renders rose-colored buttons, that `compactPreset` actually shrinks padding, that the dashboard sidebar doesn't overlap the topbar at narrow widths.

The user explicitly asked for this to land **after** the manual sweep on E167–E170 — i.e. once we have a stable target, lock it in with snapshots.

## Solution

Use the existing Playwright setup (`pnpm test:e2e`) to capture screenshot baselines for the cross-product of pages × themes × presets, then run them on every PR.

### Coverage matrix (minimum)

| Axis | Cells |
|---|---|
| **Pages** (14) | LandingPage, GettingStarted, Privacy, Terms, NotFound, SignIn, SignUp, ForgotPassword, ResetPassword, VerifyEmail, dashboard:Overview, dashboard:Sessions, dashboard:Projects, dashboard:Settings |
| **Themes** (6) | dark, indigo, navy, sage, rose, forest |
| **Presets** (2) | `default`, `compact` |
| **Viewports** (2) | desktop (1280×800), mobile (375×667) |

Total = 14 × 6 × 2 × 2 = **336 baseline screenshots**.

That's a lot, so the epic ships in two stages:

#### Stage 1 — Smoke matrix (~36 baselines)
Pages × `dark` theme × `default` preset × desktop viewport only. 14 baselines. Smoke confidence in <1 min CI.

#### Stage 2 — Full matrix (~336 baselines)
Driven by a Playwright `test.describe.parallel` that loops the matrix. Acceptance: matrix runs in <10 min on CI, baselines committed to `client/e2e/__snapshots__/`.

### Tooling

- **`@playwright/test` toHaveScreenshot()** — native, no third-party VRT service needed.
- **Mask volatile regions** — `<time>` elements, `random uuid` displays, animations frozen via `--prefers-reduced-motion`.
- **Theme + preset switching** in test setup — call `setActivePreset(...)` and `setAttribute("data-theme", ...)` before each shot.
- **Storybook** is NOT in scope — we're testing real routes, not isolated components.

## Key Files

| File | Action |
|---|---|
| `client/e2e/visual.spec.ts` | New — main VRT spec, drives the matrix |
| `client/e2e/helpers/theme-preset.ts` | New — set theme + preset before screenshot |
| `client/e2e/helpers/visual-mask.ts` | New — selector list for volatile regions to mask |
| `client/e2e/__snapshots__/` | Generated — committed to git |
| `client/playwright.config.ts` | Edit — register VRT project, set tolerance threshold |
| `.github/workflows/ci.yml` (or equivalent) | Edit — add `pnpm test:e2e --project=visual` job |
| `docs/design/design.md` | Edit — § 8 "Testing" extended with VRT recipe |

## Implementation

### Phase A — Smoke (1 day)
1. Author `theme-preset.ts` helper that calls `setActivePreset(...)` + sets `data-theme` via `page.evaluate()`.
2. Author `visual.spec.ts` covering 14 pages on dark+default+desktop.
3. Capture baselines locally; commit to `__snapshots__/`.
4. Add CI job; verify it passes on a clean run.
5. Verify it FAILS deterministically by changing one preset class string and re-running.

### Phase B — Full matrix (2 days)
1. Extend the spec with parametrized tests: `for (const theme of THEMES) for (const preset of PRESETS)`.
2. Configure Playwright to run shards in parallel; verify total runtime <10 min on CI.
3. Commit ~336 baselines.
4. Document update workflow: `pnpm test:e2e --update-snapshots` after intentional design changes.

### Phase C — Drift policy (½ day)
1. Document the "what to do when a baseline diff appears in PR review" workflow in `design.md` § 8:
   - Intentional design change → run `--update-snapshots`, commit, re-review.
   - Unintentional → fix the regression.
2. Add a Stop-verifier rule (or document a manual gate): "VRT baseline diffs require explicit `[VRT-OK]` tag in the PR description before merge."

## Acceptance Criteria

- [ ] Phase A smoke matrix: 14 baselines committed, CI runs in <2 min, deterministic
- [ ] Phase B full matrix: 336 baselines committed, CI runs in <10 min
- [ ] At least one demonstrated failure: changing a preset class triggers a snapshot diff in CI
- [ ] `design.md` § 8 documents:
  - How to run VRT locally
  - How to update baselines when a design change is intentional
  - How to interpret CI failures
- [ ] `playwright.config.ts` configures the VRT project with sensible threshold (≤ 0.1% pixel diff)
- [ ] Volatile regions masked: timestamps, request_ids, any random IDs in fixtures
- [ ] Animations frozen during VRT: `--prefers-reduced-motion: reduce` set in browser context
- [ ] Stop-verifier or manual gate doc'd for baseline-update PRs

## Alignment / Cross-Epic Hooks

- **Soft-depends on E167–E170** — VRT only makes sense once the design system is stable. Running E171 first would just lock in a moving target.
- **Pairs with E115** (E2E dashboard smoke gate) — same Playwright infrastructure; this epic extends the VRT dimension.
- **Surfaces preset-axis bugs** that unit tests can't catch (e.g. a `compact` preset slot that forgot to override a class).
- **Uses Stop-verifier** philosophy — adds a hard gate so design regressions can't slip through code review.

## Out of Scope

- **Cross-browser visual coverage** — Chromium-only is enough for V1. Add Firefox/Safari later if real bugs surface.
- **Storybook component VRT** — duplicates page-level coverage; defer until justified by need.
- **Percy / Chromatic / hosted VRT** — Playwright native is sufficient and free. Revisit if review UX becomes painful.
- **Component-isolation VRT** — full pages catch composition bugs that isolated components miss; we want the integration coverage.
- **A11y snapshot testing** — `@axe-core/playwright` is already wired (`E130`). Out of scope to extend here.
