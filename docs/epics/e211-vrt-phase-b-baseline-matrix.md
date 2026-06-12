# E211 — VRT Phase B — 336-Baseline Visual Regression Matrix

> Phase 51 — Stabilize + Phase 2 Foundation | Size: M (13 SP) | Deps: none

## Problem

The visual-regression story is infrastructure-without-ground-truth. E171 Phase A shipped a smoke matrix that captures exactly **one cell** of the design-system cross-product — `theme=dark, preset=default, viewport=1280×800` — and explicitly deferred the rest. The deferral is documented in three places that all agree:

- `client/e2e/visual.spec.ts:4-7` (file header): *"Phase B (full matrix across 6 themes × 2 presets × 2 viewports = 336 baselines) is deferred to a follow-up epic."* The spec only iterates `PUBLIC_PAGES` (10) + `DASHBOARD_PAGES` (4) = 14 pages, each hardcoded to `setThemeAndPreset(page, { theme: "dark", preset: "default" })` (`visual.spec.ts:55,86,96`) at a single `viewport: { width: 1280, height: 800 }` (`visual.spec.ts:51,70`).
- `docs/context/epic-progress.md:246` (E171 row): *"Phase A smoke matrix shipped … baselines deferred to first dev-server CI run (Option B); Phase B (336-baseline full matrix) and Phase C (drift policy) deferred to follow-up epic."*
- `docs/context/epic-progress.md:604-605` (deferred-work ledger): *"E171 Phase B — full VRT matrix (336 baselines: 14 pages × 6 themes × 2 presets × 2 viewports) + `window.__setActivePreset` bridge for tests"* and *"E171 baseline capture — first dev-server-running CI run runs `pnpm test:e2e --project=visual --update-snapshots`."*

Two concrete gaps make the matrix un-shippable today:

1. **No preset bridge.** The preset axis cannot be driven from Playwright. `client/e2e/helpers/theme-preset.ts:21-22` states the active preset is *"module-level state inside the bundle, and we don't expose it on `window` yet"*, and the helper **throws** for any preset other than `default` (`theme-preset.ts:84-88`). It already probes for a `window.__setActivePreset` bridge (`theme-preset.ts:93-104`) — but nothing mounts it.
2. **The `visual` Playwright project is theme-locked.** `client/playwright.config.ts:47` pins the visual project to `colorScheme: "dark"`, and there is no viewport/theme/preset parameterization — the project assumes the single Phase-A cell.

Net effect: any rendering regression in the 5 non-default themes (`indigo/navy/sage/rose/forest` — the union of `themes.css`), the `compact` preset, or the mobile viewport is **invisible** to the pipeline. A fork that re-themes can silently break its own UI and the test suite stays green.

## Solution

Capture the full 336-baseline matrix as a versioned visual contract, and ship the two missing pieces of test infrastructure (preset bridge + parameterized spec) so the matrix is reproducible. Baselines are captured against a **live local dev-server** — CI remains off (see Implementation step 6) and is **not** re-armed by this epic.

1. **Mount the preset bridge** — expose `window.__setActivePreset(name)` from the client bundle (test/e2e-gated) so `theme-preset.ts` can switch the preset axis at runtime, removing the `preset !== "default"` throw guard.
2. **Parameterize the spec** — refactor `visual.spec.ts` to iterate the full cross-product: 14 pages × 6 themes × 2 presets × 2 viewports = **336** screenshots, replacing the hardcoded single-cell `describe` blocks.
3. **Un-lock the `visual` project** — drive `colorScheme` from the per-test theme instead of the hardcoded `dark` in `playwright.config.ts:47`, and add the second (mobile) viewport.
4. **Capture baselines locally** — run `pnpm test:e2e --project=visual --update-snapshots` against a hand-started dev-server, commit the 336 `.png` baselines under `client/e2e/__snapshots__/`.
5. **Document the local-only capture protocol** — a short runbook (繁中) so a maintainer (or fork) can regenerate baselines after an intentional design change, without depending on CI.

## Key Files

| File | Action |
|---|---|
| `client/src/main.tsx` | Edit — mount `window.__setActivePreset` bridge (e2e/test-gated) that calls the existing `setActivePreset` from `components/ui/preset.ts` |
| `client/e2e/helpers/theme-preset.ts` | Edit — remove the `preset !== "default"` throw (`:84-88`); rely on the now-mounted bridge; keep the silent-no-op probe as the call path |
| `client/e2e/visual.spec.ts` | Rewrite — iterate 14 pages × 6 themes × 2 presets × 2 viewports = 336 cells; per-cell snapshot name encodes the axis |
| `client/playwright.config.ts` | Edit — drop the hardcoded `colorScheme: "dark"` lock on the `visual` project (`:47`); drive color-scheme + viewport from the test |
| `client/e2e/__snapshots__/` | New — 336 committed baseline `.png` files (one per matrix cell) |
| `docs/guides/zh-TW/vrt-baseline-capture.md` | New (繁中) — local-dev-server baseline-capture runbook + Phase C drift-policy note |
| `docs/context/epic-progress.md` | Edit — update the E171 deferred-work ledger (`:604-605`) to mark Phase B done; Phase C still deferred |

## Implementation

1. **RED — preset bridge contract.** Add an e2e assertion (or a focused unit test) that `window.__setActivePreset` exists and flips the active preset's class slot. It fails today (no bridge). Mount the bridge in `client/src/main.tsx` — gate it so it only attaches under e2e/dev (e.g. `import.meta.env.MODE` / a `VITE_E2E` flag), calling the existing `setActivePreset` from `components/ui/preset.ts`. Confirm the assertion goes green.
2. **GREEN — unblock the helper.** Remove the `preset !== "default"` throw in `theme-preset.ts:84-88`. The existing `window.__setActivePreset` probe (`:93-104`) now actually fires. Add a tiny re-paint settle after the preset switch (preset changes class strings, not just CSS vars) so the screenshot is stable.
3. **Parameterize the spec.** Rewrite `visual.spec.ts` to build the cross-product from four arrays: the 14 existing pages (keep `PUBLIC_PAGES` + `DASHBOARD_PAGES` split — dashboard cells still need the auth `beforeAll`), `THEMES = [dark,indigo,navy,sage,rose,forest]` (union of `themes.css`), `PRESETS = [default,compact]`, `VIEWPORTS = [{1280×800 desktop},{390×844 mobile}]`. Snapshot name = `${name}--${theme}--${preset}--${viewport}.png` so each of the 336 baselines is uniquely addressable. Keep `visualMask` + `waitForVisualReady` per cell.
4. **Un-lock the project config.** In `playwright.config.ts`, remove `colorScheme: "dark"` from the `visual` project (`:47`) — dark-vs-light is now a function of the theme under test, applied via `setThemeAndPreset` / `emulateMedia`, not a project-global. Keep `reducedMotion: "reduce"` and the `maxDiffPixelRatio: 0.01` tolerance. Do **not** add new browser projects.
4b. **Critical-state snapshots (bounded use-case set).** The 336 cells capture each route's *default* render — but a smoke matrix that never exercises error/empty/validation states misses the renders most likely to regress. Add a small, explicitly-bounded set of *state* snapshots, captured in the **default theme + default preset + desktop viewport only** (these renders are state-driven, not theme-driven — cross-producting them ×24 would explode the baseline count for little marginal signal). Drive and snapshot: (i) **SignIn validation-error** (submitted with bad input → banner + field errors visible); (ii) **ResetPassword invalid-token** error state; (iii) an **empty-state** dashboard view (e.g. Projects with zero items, via an MSW empty response); (iv) confirm **NotFoundPage (404)** is in the 14-route set — if not, add it. Name these `${name}--state-${state}.png`; keep the set to ≈4–6 snapshots and list them in the 繁中 runbook.
5. **Capture baselines on a live local dev-server.** This step is **local-only and manual** — it does not run in `/athena:batch auto` headless cron (no browser/dev-server there). Start the dev-server by hand (`pnpm --filter client dev`, or let Playwright's `webServer` reuse it — `playwright.config.ts:84` already sets `reuseExistingServer: !isCI`), then run `pnpm test:e2e --project=visual --update-snapshots`. Inspect the 336 generated PNGs, then commit them under `client/e2e/__snapshots__/`.
6. **Document the CI caveat explicitly.** CI is `workflow_dispatch`-only (disabled in `c7015b6`, 2026-05-20) and this epic does **not** re-arm it. Write `docs/guides/zh-TW/vrt-baseline-capture.md` (繁中) covering: start-the-dev-server → `--update-snapshots` → review diff → commit; the rule that baselines regenerate only after an *intentional* design change; and a one-line statement that Phase C (automated drift gating in CI) stays deferred.
7. **Regression sweep.** Re-run the non-visual e2e projects (`chromium`, `a11y`) to confirm the `visual.spec.ts` rewrite + config change didn't leak into them (they already `testIgnore`/`testMatch`-exclude `visual.spec.ts` — `playwright.config.ts:36`). Run the client unit suite green.

## Acceptance Criteria

- [ ] `window.__setActivePreset(name)` is mounted (e2e/dev-gated) and flips the active preset; an e2e/unit assertion proves it
- [ ] `theme-preset.ts` no longer throws for `preset !== "default"`; both `default` and `compact` switch correctly at runtime
- [ ] `visual.spec.ts` enumerates the full **336-cell** matrix (14 pages × 6 themes × 2 presets × 2 viewports); each cell's snapshot name encodes page+theme+preset+viewport
- [ ] The `visual` Playwright project is no longer hardcoded to `colorScheme: "dark"`; color-scheme follows the theme under test
- [ ] 336 baseline `.png` files are committed under `client/e2e/__snapshots__/`, captured against a live local dev-server
- [ ] A bounded set (≈4–6) of **critical-state** snapshots — SignIn validation-error, ResetPassword invalid-token, empty-list dashboard, NotFoundPage 404 — is captured in the default theme/preset/desktop and committed, so state-rendering regressions are caught (full state × theme × preset cross-product explicitly deferred)
- [ ] `pnpm test:e2e --project=visual` passes green against the committed baselines on a local dev-server run
- [ ] `chromium` + `a11y` e2e projects and the client unit suite remain green after the rewrite
- [ ] `docs/guides/zh-TW/vrt-baseline-capture.md` (繁中) documents the local-dev-server capture protocol and states Phase C drift-gating + CI re-arm are out of scope
- [ ] `epic-progress.md` E171 deferred-work ledger (`:604-605`) is updated to mark Phase B done

## Alignment / Cross-Epic Hooks

- **Completes E171's deferred Phase B** — same `visual.spec.ts` / `theme-preset.ts` / `playwright.config.ts` surface E171 Phase A established; this fills in the cross-product it scoped out.
- **Soft-shares infra with E212** (cross-theme/preset a11y matrix). Both iterate the same 6-themes × 2-presets × 14-pages axis and both need a live local dev-server. If E212 runs in the same hands-on session, the `window.__setActivePreset` bridge mounted here is reusable by the a11y matrix — but this is **soft sequencing only**, not a hard dependency; each epic stands alone.
- **Honors the CI-off decision** (`c7015b6`, 2026-05-20) — captures baselines via a local dev-server (the deferral's original "Option B" path), and does not re-arm GitHub Actions.
- **Phase C (drift policy) stays deferred** — automated baseline-drift gating in CI is explicitly out of scope (see Out of Scope), consistent with `epic-progress.md:246`.

## Out of Scope

- **No CI re-arm.** GitHub Actions stays `workflow_dispatch`-only (`c7015b6`). Baseline capture is a local-dev-server, hands-on operation — this epic does not wire VRT into any automated CI gate.
- **Phase C drift policy** — automated screenshot-diff gating / failure-on-drift in the pipeline is a separate follow-up, not this epic.
- **No headless-batch execution.** This epic is **not** runnable via `/athena:batch auto` cron autopilot (no browser / dev-server in that path) — it requires a hands-on local session.
- **No new themes or presets.** The matrix is fixed at the 6 themes + 2 presets that ship today; adding a 7th theme or 3rd preset is a different epic.
- **No full state × theme × preset cross-product.** The critical-state snapshots (step 4b) are default-cell only; exhaustively cross-producting every page state across all 24 visual combinations is deferred — baseline-count explosion for marginal signal.
- **No primitive/page restyling.** This epic captures the *current* rendering as ground truth; it does not change any component visuals (a real diff would mean a regression, not an intended change).
- **No a11y matrix.** Cross-theme/preset axe-core coverage is E212's scope, not this one.

## Provenance

- Spec source: `/athena:plan auto` Cycle 23 (2026-06-02) — verified ground-truth #1: E171 Phase A shipped the 14-page smoke matrix; the 336-baseline full matrix was deferred (`epic-progress.md:251`/`:246`, `visual.spec.ts:4-7`). Live-local-dev-server execution caveat carried from the Cycle 23 risk assessment (CI is off; not re-armed).
- Approved via `/athena:plan approve all` on 2026-06-02.
