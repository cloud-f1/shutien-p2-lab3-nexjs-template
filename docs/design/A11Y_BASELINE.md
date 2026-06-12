# Accessibility Baseline (E177)

> **Goal:** prove the "a11y-first" claim with axe-core. Every page + every
> interactive primitive in the design system must pass WCAG 2.1 AA with
> **zero violations** before merging.

This doc is the contract between the design-system primitives, the page
authors who compose them, and CI. If a scan starts failing, first look here
for the rules + recipes; don't add allowlist suppressions.

---

## What gets scanned

### Tags (axe rule sets)

`runAxe(page)` in [`client/e2e/helpers/a11y-runner.ts`](../../client/e2e/helpers/a11y-runner.ts)
runs axe with the union of:

| Tag | Coverage |
|---|---|
| `wcag2a` | WCAG 2.0 Level A — minimum bar |
| `wcag2aa` | WCAG 2.0 Level AA — text contrast, focus visibility |
| `wcag21a` | WCAG 2.1 Level A — orientation, identify-input-purpose |
| `wcag21aa` | WCAG 2.1 Level AA — non-text contrast, reflow, target size |

`wcag2aaa` / `wcag21aaa` are intentionally excluded — AAA blocks too many
palette choices. AAA passes are tracked as a separate (non-gating) report.

### Pages covered

[`client/e2e/a11y.spec.ts`](../../client/e2e/a11y.spec.ts) sweeps the same
14 routes the visual regression suite (E171) covers:

| Group | Routes |
|---|---|
| Public | `/`, `/getting-started`, `/privacy`, `/terms`, `/non-existent` (404) |
| Auth | `/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email?token=test` |
| Dashboard | `/dashboard/overview`, `/dashboard/sessions`, `/dashboard/projects`, `/dashboard/settings` |

**E212 — the gate now spans the full 6 themes × 2 presets matrix.** Every
route is swept in all **12 cells** (`A11Y_CELLS` in
[`client/e2e/helpers/a11y-matrix.ts`](../../client/e2e/helpers/a11y-matrix.ts)),
so WCAG 2.1 AA is proven **theme-and-preset-invariant** — a fork that
re-themes or swaps presets can no longer silently regress contrast. The
single-cell deferral that E177 called "E177.b" is **closed**.

| Axis | Values | Source |
|---|---|---|
| Theme | dark · indigo · navy · sage · rose · forest | `styles/themes.css` `[data-theme]` |
| Preset | default · compact | `components/ui/preset.ts` |

The `compact` preset is exercised at runtime via the `window.__setActivePreset`
bridge mounted dev/test-only in `src/main.tsx` (E211) and driven by
`setThemeAndPreset` in `e2e/helpers/theme-preset.ts`.

### Primitive interactions covered

Modal/Drawer/Toast aren't in the DOM until triggered, so they get dedicated
interaction specs:

| Primitive | Trigger path | Scan target |
|---|---|---|
| `<Modal>` | `/dashboard/settings` → "Delete Account" button | full page incl. dialog shell |
| `<Toast>` | `/signin` with bad creds → `<ToastProvider>` push or inline `[role="alert"]` banner | full page incl. toast container |
| `<Drawer>` | _(no real-app trigger today — landing in E177.b)_ | _deferred_ |

The other 32+ primitives are exercised inline by the page sweep (every page
composes the primitives via `client/src/components/ui/`).

### Interaction a11y sweep (axe-blind use-cases) — E212

Static axe cannot catch keyboard, focus, or announcement failures. The
interaction spec
[`client/e2e/a11y-interaction.spec.ts`](../../client/e2e/a11y-interaction.spec.ts)
covers the axe-blind cases in a **single default cell** (these behaviors are
theme/preset-invariant, so they need not multiply across the 12-cell matrix):

| Use-case | Assertion |
|---|---|
| Keyboard navigation | Tab reaches a visible, on-screen control with a focus ring; logical order |
| Focus trap + Escape | `<Modal>` moves focus inside on open; Escape closes and restores focus to the trigger |
| Form-error announcement | bad input on `/signin` is programmatically associated (`aria-describedby`) and surfaced in an `aria-live` / `role="alert"` region |
| Skip-link | first Tab reaches the global `<SkipNav>`; Enter points the document at `#main-content` |
| Reduced motion | under `prefers-reduced-motion: reduce` no element keeps an active transition/animation (enforced by a global `@media` rule in `globals.css`) |

### Vitest-side a11y

Static landmark / `aria-*` checks live in
[`client/src/tests/a11y/accessibility.test.tsx`](../../client/src/tests/a11y/accessibility.test.tsx)
— 22 unit-level assertions across SkipNav, ARIA landmarks, DashboardLayout,
form `aria-describedby`, and LandingPage icon `aria-hidden`. These run as
part of the standard `pnpm --filter client test:run` and complement (don't
replace) the Playwright sweep.

`vitest-axe` / `jest-axe` are intentionally NOT installed — adding them
duplicates the Playwright sweep without catching real-render contrast or
focus issues. If Playwright coverage ever drops, revisit.

---

## How to run locally

```bash
# A11y matrix only (Playwright project [a11y]) — needs dev + backend up:
cd client
pnpm test:e2e --project=a11y

# Full e2e suite (chromium + visual + a11y):
pnpm test:e2e

# Vitest static a11y checks:
pnpm test:run -- src/tests/a11y/
```

CI runs `pnpm test:e2e --project=a11y` independently; a single violation
fails the PR.

## Status — Zero-violations baseline

| Field | Value |
|---|---|
| Specs | `a11y.spec.ts` (page matrix) · `a11y-primitives.spec.ts` (Modal/Toast) · `a11y-interaction.spec.ts` (axe-blind) |
| Helpers | `e2e/helpers/a11y-runner.ts` · `e2e/helpers/a11y-matrix.ts` · `e2e/helpers/theme-preset.ts` |
| Playwright project | `[a11y]` — **6 themes × 2 presets = 12 cells × 14 pages** + 2 primitive scans/cell + interaction sweep |
| Routes covered | 14 (× 12 cells) |
| Total a11y tests | **203** (all green) |
| Execution | **live local dev-server** (Vite :3100 + backend :8080). CI is `workflow_dispatch`-only since 2026-05-20 — the matrix is NOT re-armed on every push (owner decision); it runs in hands-on local sessions, same lane as the E211 VRT matrix. |
| Sealed | **E212** — 2026-06-02, 203/203 tests, 0 axe violations across all 12 cells + interaction sweep. |

### Token fixes that sealed the matrix (E212)

The cross-theme sweep surfaced real contrast bugs that the single (dark,
default) cell never exercised. All were fixed at the **token / primitive**
level — **no `disableRules` allowlist** was added:

- `styles/themes.css` — bumped `--text-secondary` + `--text-muted` (dark),
  `--text-muted` (all 6 themes), `--success`/`--green` + `--accent`/`--amber`
  (light themes), `--danger` (light themes), rose `--primary`, sage
  `--sidebar-active` to clear 4.5:1 as text.
- `styles/globals.css` — global `a { color: inherit }` (Tailwind preflight
  is off, so bare `<a>` inherited the UA `#0000ee` link blue) + a global
  `prefers-reduced-motion: reduce` rule.
- `components/ui/preset.ts` — `navBar.link` + DataTable `rowAction` slots got
  explicit colors / `bg-transparent` (preflight-off `<button>` was painting
  the UA `buttonface` ~#efefef).
- `components/dashboard/UserMenu.tsx` + `DashboardLayout.css` — closed menu is
  now `aria-hidden` + `visibility:hidden`; `nav-badge.purple`,
  `topbar-btn.primary`, `nav-section-label`, `user-chevron` colors fixed.
- `pages/dashboard/views/SettingsView.tsx` — delete-account modal migrated to
  the `<Modal>` primitive (focus trap + Escape + restore); unlabeled readonly
  inputs + the auto-promote toggle got `aria-label`s.

---

## How to debug a violation

1. Read the failure log — `formatViolations()` prints rule id, impact,
   first node selector, and the help URL. Open the URL.
2. Reproduce in the browser at the same theme/preset cell — most violations
   are deterministic (missing `aria-label` on a button, contrast ratio
   under 4.5:1, missing `<label for>` on an input).
3. Fix the **primitive** — never the page. Rationale: the page sweep finds
   the violation only because the primitive ships it. Fixing the page
   masks the same bug everywhere else.
4. Re-run `pnpm test:e2e --project=a11y -g "<failing test name>"`.
5. Add a unit test in
   [`client/src/components/ui/__tests__/`](../../client/src/components/ui/__tests__/)
   that asserts the new ARIA invariant so the next regression fails fast.

### Common offenders + recipes

| Symptom | Fix | Where |
|---|---|---|
| Icon-only button, no name | Add `aria-label` (translatable via `useTranslation('primitives')`) | the primitive's `<button>` |
| Color contrast on `text-muted` | Bump the `--text-muted` token in `themes.css` for the offending theme | `client/src/styles/themes.css` |
| Form input without label | Wrap in `<FormField>` (E173) — never raw `<input>` | the page composing the primitive |
| Toast not announced | Verify `role="alert"` or `aria-live="polite"` on the live region | `client/src/components/ui/Toast.tsx` |
| Modal title not associated | Pass `title` prop — primitive auto-wires `aria-labelledby` | the call site |
| Dialog without focus trap | Use `<Modal>` / `<Drawer>` (E174) — never custom portals | the page composing the primitive |

---

## How to suppress an intentional violation

**Don't.** The point of E177 is the zero-violations baseline. If a violation
is intentional (e.g. a known-broken third-party widget), the right move is:

1. Open an epic to fix or replace the offending component.
2. Until that ships, scope the suppression to the smallest possible
   selector. Use `runAxe(page, { exclude: '[data-vendor="x"]' })` rather
   than `disableRules: [...]` — exclusion preserves the rule everywhere
   else.
3. Document the suppression here, in this section, with an expiry date
   and a tracking-epic link. No silent suppressions.

There are **no** active suppressions as of E177 closeout.

---

## Cross-references

| Topic | Doc |
|---|---|
| Focus trap (Modal / Drawer) | E174 docs in [`docs/epics/`](../epics/) |
| Tabs ARIA APG keyboard model | E178 docs in [`docs/epics/`](../epics/) |
| i18n bridge for `aria-label` strings | E172 — `client/src/locales/{lang}/primitives.json` |
| Visual regression matrix | E171 — `client/e2e/visual.spec.ts` |
| Static a11y tests | `client/src/tests/a11y/accessibility.test.tsx` |
| Stop verifier rules | `scripts/hooks/stop-verifier.sh` (Rules #1–#22) |

---

## Out of scope (deferred to follow-ups)

- **Cross-theme/preset contrast sweep** (12 cells) — ✅ **shipped in E212** (no longer deferred).
- **Manual screen-reader testing** with NVDA / JAWS / VoiceOver — human-gated step.
- **Cognitive a11y** (reading-level, attention, memory) — outside axe-core scope.
- **WCAG AAA** — AA is the bar; AAA blocks too many palette choices.
- **`vitest-axe`** integration — still deferred (needs a new dep).
- **Drawer interaction scan** — needs a real-app trigger; still no live trigger.

---

## 新增一個 cell（加主題 / 加 preset）— 給貢獻者

> 此 a11y gate 現在橫跨 **6 主題 × 2 presets = 12 個 cell**，定義在
> [`client/e2e/helpers/a11y-matrix.ts`](../../client/e2e/helpers/a11y-matrix.ts)
> 的 `A11Y_CELLS`（`A11Y_THEMES × A11Y_PRESETS` 笛卡兒積）。任何 fork 只要
> 新增主題或 preset，**矩陣會自動把它納入掃描**——前提是把新軸值加進這兩個陣列。

**新增一個主題（例：`ocean`）**

1. 在 `client/src/styles/themes.css` 加上完整的 `[data-theme="ocean"]` 區塊
   （47 個變數，照 `docs/design/css-architecture.md` 的「Adding a Theme」六步）。
2. 在 `client/src/components/ThemeProvider.tsx` 的 `Theme` union + `THEME_OPTIONS`
   加入 `ocean`。
3. 在 `a11y-matrix.ts` 的 `A11Y_THEMES` 陣列加入 `"ocean"`，並在
   `theme-preset.ts` 的 `Theme` type union 同步加入。
4. 跑 `cd client && pnpm exec playwright test --project=a11y` —— 矩陣會自動把
   `ocean × {default, compact}` 兩個 cell 全部掃過。

**新增一個 preset（例：`spacious`）**

1. 在 `client/src/components/ui/presets/spacious.ts` 定義 preset slot map，
   並從 `components/ui` 匯出。
2. 在 `client/src/main.tsx` 的 `__setActivePreset` bridge `PRESETS` map 加入
   `spacious`，並在 `theme-preset.ts` 的 `Preset` union 加入。
3. 在 `a11y-matrix.ts` 的 `A11Y_PRESETS` 陣列加入 `"spacious"`。
4. 重跑 `[a11y]` project —— 6 個主題 × 新 preset 的 cell 會自動加入。

**重要紀律**：若新 cell 掃出 contrast / aria 違規，**修主題 token 或 primitive**
（`styles/themes.css` 或 `components/ui/`），**絕不**加 `disableRules` allowlist。
違規之所以出現，是因為 token / primitive 本身沒過 AA——修頁面只會把 bug 藏到別處。
debug 流程見上方「How to debug a violation」。

---

## Contributor / fork-author extension guide (E215)

The fork-author extension guide that E177 deferred **shipped in E215** —
bilingual, docs-only. Read it when you add a custom domain route, theme, or
primitive to your fork and need to keep it WCAG AA:

- [`docs/guides/en/accessibility.md`](../guides/en/accessibility.md) — English
- [`docs/guides/zh-TW/accessibility.md`](../guides/zh-TW/accessibility.md) — 繁體中文

This baseline doc remains the source of truth for *debugging a failing* scan;
the E215 guide is the playbook for *extending* the scan to new surfaces.
