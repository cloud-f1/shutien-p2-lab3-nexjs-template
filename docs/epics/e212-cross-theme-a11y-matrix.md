# E212 — Cross-Theme/Preset Accessibility Matrix (axe-core × 6 themes × 2 presets × 14 pages)

> Phase 51 — Stabilize + Phase 2 Foundation | Size: M (10 SP) | Deps: none

## Problem

E177 (PR #153) shipped an axe-core `[a11y]` Playwright project and proved **0 static violations across all primitives** — but only for the **default theme + preset**. The design system has two orthogonal visual axes (6 themes × 2 presets), and a fork that re-themes or swaps presets can regress WCAG 2.1 AA — most plausibly a contrast-ratio failure in a palette E177 never ran through axe — entirely undetected.

The single-cell coverage is hardcoded, not incidental:

- `client/e2e/a11y.spec.ts` calls `setThemeAndPreset(page, { theme: "dark", preset: "default" })` at every sweep site (the public sweep at line 74, the dashboard pre-nav at line 105, and the post-login re-apply at line 113). The page matrix itself is real — 10 `PUBLIC_PAGES` (lines 37-48) + 4 `DASHBOARD_PAGES` (lines 51-56) = the 14-route surface — but it only ever runs in one cell.
- `client/e2e/a11y-primitives.spec.ts` hardcodes the same single cell at lines 51 and 79.
- The spec header comments name the gap explicitly: "Default theme + preset only; the cross-product (6 themes × 2 presets) is deferred to **E177.b** once the baseline is sealed" (`a11y.spec.ts:6-7`; restated `a11y-primitives.spec.ts:10`).
- `client/playwright.config.ts:52-58` documents the `[a11y]` project as a "Single (theme=dark, preset=default) cell so CI cost stays bounded; the full theme×preset matrix is a follow-up."
- `docs/context/epic-progress.md:252` records the E177 row with "0 static violations… baseline capture deferred"; line 608 names the follow-up verbatim: "**E177.b** — cross-theme/cross-preset a11y matrix (axe scan across 6 themes × 2 presets — deferred from E177 for CI speed)."

There is also a foundation gap E212 must close first: preset switching from Playwright is currently a no-op. `client/e2e/helpers/theme-preset.ts` (header lines 18-22) states "Preset switching from a Playwright context is currently a no-op aside from 'default' … When we extend to compact (Phase B), we'll thread a `window.__setActivePreset` bridge through `src/main.tsx`." Until that bridge exists, the `preset` axis cannot actually be exercised — the helper today only validates that the requested preset is `default`.

Net result: the template asserts "a11y-first" but proves it for 1 of 12 theme×preset combinations. This epic makes WCAG AA **theme-and-preset-invariant**, so a fork re-theming cannot silently break it.

## Solution

Extend the existing `[a11y]` project from a single (dark, default) cell to the full 6 themes × 2 presets matrix across the same 14 pages, reusing E177's `runAxe` discipline (zero violations, no rule allowlist) and E171's `theme-preset.ts` helpers.

1. **Build the preset bridge** — thread the `window.__setActivePreset` hook through `src/main.tsx` so a Playwright context can actually switch the active preset (today it is module-level singleton state with no test-time entry point). Make `setThemeAndPreset` in `theme-preset.ts` invoke it for `compact` instead of no-op-validating `default`.
2. **Parametrize the sweep** — replace the two hardcoded `{ theme: "dark", preset: "default" }` call sites in `a11y.spec.ts` (and the primitives spec) with a loop over the `THEME × PRESET` cross-product, keeping the existing 14-page list and the existing per-page zero-violation assertion.
3. **Keep specs under the 200-line Stop-Verifier limit** — extract the cross-product cell list and the shared sweep body into a small `e2e/helpers/a11y-matrix.ts` so `a11y.spec.ts` and `a11y-primitives.spec.ts` stay lean (same split discipline E177 already used to keep two spec files under the cap).
4. **Document the WCAG-invariance contract** — update `docs/design/A11Y_BASELINE.md` (繁中 contributor-facing section) so a fork knows the a11y gate now spans all themes × presets and how to add a theme/preset cell.
5. **Local execution only** — same execution caveat as E211: this captures/runs via a **live local dev-server** + Playwright, NOT the headless `/athena:batch auto` cron loop (CI is `workflow_dispatch`-only since 2026-05-20). No CI re-arm.

## Key Files

| File | Action |
|---|---|
| `client/src/main.tsx` | Edit — expose `window.__setActivePreset` test bridge (dev/test only) so Playwright can switch the active preset |
| `client/e2e/helpers/theme-preset.ts` | Edit — make `setThemeAndPreset` actually apply `compact` via the bridge; drop the `default`-only no-op validation (header lines 18-22) |
| `client/e2e/helpers/a11y-matrix.ts` | New — `THEMES × PRESETS` cell list + shared zero-violation sweep helper (keeps specs under 200 lines) |
| `client/e2e/a11y.spec.ts` | Edit — loop the 14-page matrix over all cells instead of the hardcoded single cell (lines 74, 105, 113) |
| `client/e2e/a11y-primitives.spec.ts` | Edit — loop primitive interaction scans over all cells (lines 51, 79) |
| `client/playwright.config.ts` | Edit — update the `[a11y]` project comment (lines 52-58) to reflect the full matrix; keep `--project=a11y` invocation |
| `docs/design/A11Y_BASELINE.md` | Edit — 繁中 contributor section: gate now spans 6 themes × 2 presets; recipe for adding a cell |
| `docs/context/epic-progress.md` | Edit — replace the E177.b deferral line (608) with E212-DONE; update E177 row note |

## Implementation

1. Read `theme-preset.ts` in full and confirm the `Theme` union (`dark|indigo|navy|sage|rose|forest`) and `Preset` union (`default|compact`) — these define the 6 × 2 = 12 cells. RED: add a Playwright test that calls `setThemeAndPreset(page, { theme: "dark", preset: "compact" })` and asserts the active preset actually changed in the DOM/bundle — it fails today because the helper no-ops on non-default presets.
2. Add the `window.__setActivePreset` bridge in `src/main.tsx`, guarded so it only attaches in dev/test (e.g. `import.meta.env.DEV` or a test flag) and never ships to production. GREEN: the RED test from step 1 passes.
3. Update `setThemeAndPreset` to seed the preset via the bridge before navigation (mirroring how it already seeds the Zustand theme persist key before boot), removing the `default`-only validation guard.
4. Create `e2e/helpers/a11y-matrix.ts`: export `A11Y_CELLS` = cartesian product of the 6 themes × 2 presets, plus a `sweepZeroViolations(page, name, path)` helper wrapping `runAxe` + `formatViolations` + the existing `expect(...).toHaveLength(0)` assertion (lift the body from `a11y.spec.ts:72-84`).
5. Refactor `a11y.spec.ts`: wrap the existing public + dashboard page loops in an outer `for (const cell of A11Y_CELLS)` loop; call `setThemeAndPreset(page, cell)` per cell; keep the 14-page list and dashboard sign-in flow unchanged. Verify the file stays < 200 lines (extract more into `a11y-matrix.ts` if needed).
6. Refactor `a11y-primitives.spec.ts` the same way for Modal/Toast/E130 scans; keep it < 200 lines.
6b. **Interaction a11y sweep (axe-blind use-cases).** Static axe cannot catch keyboard, focus, or announcement failures — the a11y bugs that actually ship. Add `e2e/a11y-interaction.spec.ts` (a **single default cell** — these behaviors are theme/preset-invariant, so they need not multiply across the 12-cell matrix): (i) **keyboard navigation** — tab through each public page's interactive controls; assert a visible focus ring, logical tab order, and that focus never lands off-screen or on a hidden element; (ii) **focus trap + Escape** on `Modal` / `DropdownMenu` — focus stays within while open and returns to the trigger on close; (iii) **form-error announcement** — submit SignIn / ResetPassword with bad input and assert the error is programmatically associated (`aria-describedby`) and rendered in an `aria-live` / `role="alert"` region (not just colored text); (iv) **skip-link** reaches `<main>`; (v) **prefers-reduced-motion** honored — no transition/animation under `emulateMedia({ reducedMotion: "reduce" })`. Keep < 200 lines (lift shared helpers into `a11y-matrix.ts`).
7. Update `playwright.config.ts` `[a11y]` project comment + keep `testMatch: /a11y(-[\w-]+)?\.spec\.ts/` (note the new `a11y-interaction.spec.ts` matches it). Document the matrix size and that it runs against a live local dev-server (CI off).
8. Run locally against a live dev-server: `pnpm test:e2e --project=a11y` — assert **zero violations across all 12 cells × 14 pages**. If any cell surfaces a contrast/aria violation, FIX the primitive/theme token (do NOT add a `disableRules` allowlist — E177 discipline, `a11y.spec.ts:20-21`).
9. Update `docs/design/A11Y_BASELINE.md` (繁中 contributor section) and `epic-progress.md` (retire the line-608 E177.b deferral; mark E212 DONE).

## Acceptance Criteria

- [ ] `client/e2e/helpers/a11y-matrix.ts` exists and exports the full 6 themes × 2 presets cell list (12 cells); no theme or preset omitted
- [ ] `a11y.spec.ts` and `a11y-primitives.spec.ts` run their existing 14-page / primitive-interaction sweeps across **all 12 cells** — no remaining hardcoded `{ theme: "dark", preset: "default" }` call site
- [ ] `window.__setActivePreset` is threaded through `src/main.tsx`, guarded to dev/test only (never attaches in a production build), and `setThemeAndPreset` actually applies `compact` (the `default`-only no-op in `theme-preset.ts:18-22` is gone)
- [ ] A local `pnpm test:e2e --project=a11y` run reports **zero axe violations across every cell × page** (no `disableRules` allowlist added — violations are fixed at the primitive/token level)
- [ ] **Interaction a11y sweep** (`a11y-interaction.spec.ts`, single default cell) passes: keyboard nav with visible focus + logical order, Modal/DropdownMenu focus-trap + Escape-returns-focus, form-error `aria-describedby` + live-region announcement, skip-link to `<main>`, and reduced-motion honored — the axe-blind use-cases
- [ ] Both spec files remain under the 200-line Stop-Verifier limit (shared body lives in `a11y-matrix.ts`)
- [ ] `playwright.config.ts` `[a11y]` project comment reflects the full matrix and the live-local-dev-server execution caveat (no CI re-arm)
- [ ] `docs/design/A11Y_BASELINE.md` documents the cross-theme/preset gate + an add-a-cell recipe, in 繁體中文 for the contributor-facing section
- [ ] `epic-progress.md` line-608 E177.b deferral is retired and the E177 row note is updated to point at E212

## Alignment / Cross-Epic Hooks

- **Closes E177's named follow-up** — this IS "E177.b" (`epic-progress.md:608`); E177 explicitly deferred the cross-product "for CI speed" (`a11y.spec.ts:6-7`).
- **Soft-paired with E211 (VRT Phase B)** — both extend the same `theme-preset.ts` helper across the same 6 themes × 2 presets matrix; the `window.__setActivePreset` bridge this epic builds is the same bridge E211 needs to capture compact-preset baselines. Sequencing E212 and E211 in the same hands-on local session avoids building the bridge twice — but this is **soft sequencing, not a hard Dep** (each epic ships its own value independently).
- **Same execution lane as E211** — both run via a live local dev-server + Playwright, outside the headless `/athena:batch auto` cron path. Neither fits the autopilot loop.
- **Feeds E215 (fork a11y extension guide)** — E215's "how a fork extends the a11y matrix" doc references the matrix shape this epic ships. Soft downstream reference, not a Dep.

## Out of Scope

- Capturing **visual** baselines (the 336-image VRT matrix) — that is E211; this epic captures the **a11y** matrix (axe assertions, no screenshots).
- Re-arming CI to run the matrix on every push — CI is `workflow_dispatch`-only by owner decision (2026-05-20); this epic captures/runs locally only.
- Adding new themes or presets — the matrix spans the **6 themes × 2 presets that ship today**; adding a 7th theme is a separate epic.
- `vitest-axe` integration — vitest-side a11y assertions for pure-UI primitives stay deferred (named in `epic-progress.md:609`; needs a new dep).
- Authoring the fork-facing WCAG-extension guide for custom domains — that is E215 (docs-only); E212 ships only the `A11Y_BASELINE.md` contract update.

## Provenance

- Spec source: `/athena:plan auto` Cycle 23 (2026-06-02) — proposed as P1 / 10 SP; "E177 shipped a static axe-core check (0 violations) but deferred the dynamic matrix (`epic-progress.md:252`). Run axe across 6 themes × 2 presets × 14 pages so WCAG AA is proven theme-invariant." Critic verdict SOLID; planner caveat: live-dev-server execution (same as E211).
- Approved via `/athena:plan approve all` on 2026-06-02.
