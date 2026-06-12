# Accessibility Extension Guide — Keeping Your Fork WCAG AA

> You forked this template and you're adding a custom domain, page, theme, or
> primitive. The template ships **WCAG 2.1 AA-clean** (zero axe-core
> violations across 14 routes — see [E177](../../epics/e177-a11y-audit-sweep.md)),
> but that guarantee only covers the surfaces that existed at fork time. This
> guide tells you how to keep your *new* surfaces above the same bar.
>
> Docs-only. Nothing here changes behavior — it documents the a11y contract
> that already lives in the test code and shows you how to extend it.

---

## TL;DR

1. Every new route you add (via `make new-domain` or `/athena:domain`) is
   **not** in the a11y sweep until you add it to the route list in
   [`client/e2e/a11y.spec.ts`](../../../client/e2e/a11y.spec.ts).
2. Custom theme tokens must clear **4.5:1** (normal text) / **3:1** (large
   text + non-text UI) contrast. See the [token table in §3](#3-custom-token-contrast-targets).
3. Icon-only buttons need `aria-label`; dialogs use `<Modal>` / `<Drawer>`;
   live regions use `role="alert"` / `aria-live`. See [§4](#4-keyboard--aria-authoring-rules).
4. Run the gate locally with `cd client && pnpm test:e2e --project=a11y`.
   A single violation fails the run.

---

## 1. What the template already guarantees

The contract is enforced by code, not by promise. The "where" column names
the exact file so you can verify each claim.

| Guarantee | Where it lives |
|---|---|
| **WCAG 2.1 Level A + AA**, zero violations | `runAxe()` runs axe with `WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]` in [`client/e2e/helpers/a11y-runner.ts:22`](../../../client/e2e/helpers/a11y-runner.ts) |
| **14 routes** swept (public + auth + dashboard) | `PUBLIC_PAGES` + `DASHBOARD_PAGES` in [`client/e2e/a11y.spec.ts:37-56`](../../../client/e2e/a11y.spec.ts) |
| **Primitive interactions** scanned (Modal + Toast) | [`client/e2e/a11y-primitives.spec.ts:50-104`](../../../client/e2e/a11y-primitives.spec.ts) |
| **Static landmark / ARIA** checks (22 unit assertions) | [`client/src/tests/a11y/accessibility.test.tsx`](../../../client/src/tests/a11y/accessibility.test.tsx) |
| The **gate** — a single violation fails the PR | Playwright project `[a11y]` in `client/playwright.config.ts` (`name: "a11y"`, `testMatch: /a11y(-[\w-]+)?\.spec\.ts/`) |

**AAA is intentionally out of scope.** `wcag2aaa` / `wcag21aaa` are excluded
because AAA blocks too many palette choices (see
[`A11Y_BASELINE.md`](../../design/A11Y_BASELINE.md) §"What gets scanned"). AA
is the bar — for the template and for your fork.

**Important caveat — single-cell coverage.** Every scan today runs at one
cell: `{ theme: "dark", preset: "default" }` (see
[`a11y.spec.ts:74`](../../../client/e2e/a11y.spec.ts) and
[`a11y-primitives.spec.ts:51`](../../../client/e2e/a11y-primitives.spec.ts)).
The 6-theme × 2-preset cross-product is **deferred** (tracked as the
cross-theme a11y matrix; see [§5](#5-the-cross-theme-matrix-e212-and-e177b)).
This is exactly why §3 matters: if you re-theme or add a page that renders on
a non-default theme, **no automated scan checks your contrast** — you must
clear the bars by hand.

```bash
# Run the a11y gate locally (needs server on :8080 + client dev on :3100):
cd client
pnpm test:e2e --project=a11y

# Static (Vitest) landmark / aria checks — no servers needed:
pnpm test:run -- src/tests/a11y/
```

---

## 2. Extend the matrix for your domain

When you scaffold a domain with `make new-domain NAME=notes`
([`Makefile:297-299`](../../../Makefile) → `scripts/new-domain.sh`) or
`/athena:domain notes` ([`.claude/commands/athena/domain.md`](../../../.claude/commands/athena/domain.md)),
the generator creates a page at `client/src/pages/{kebab-plural}/` and reminds
you to wire its route into `App.tsx`. **That route is invisible to the a11y
sweep until you add it.** Two edits close the gap.

### 2a. Add your route to the page sweep

The dashboard sweep iterates `DASHBOARD_PAGES` in
[`client/e2e/a11y.spec.ts:51-56`](../../../client/e2e/a11y.spec.ts). Add your
new route to that array (use `PUBLIC_PAGES` instead if the route is
unauthenticated):

```ts
// client/e2e/a11y.spec.ts
const DASHBOARD_PAGES: ReadonlyArray<{ name: string; path: string }> = [
  { name: "dashboard-overview", path: "/dashboard/overview" },
  { name: "dashboard-sessions", path: "/dashboard/sessions" },
  { name: "dashboard-projects", path: "/dashboard/projects" },
  { name: "dashboard-settings", path: "/dashboard/settings" },
  { name: "notes", path: "/dashboard/notes" }, // ← your new domain route
];
```

That's the whole change. The existing `for (const { name, path } of
DASHBOARD_PAGES)` loop signs in, navigates, runs `runAxe(page)`, and asserts
`.toHaveLength(0)` for every entry — including yours.

### 2b. Add a custom primitive's interaction scan

Modal, Drawer, and Toast aren't in the DOM until triggered, so the page sweep
can't reach them — they get dedicated interaction specs in
[`client/e2e/a11y-primitives.spec.ts`](../../../client/e2e/a11y-primitives.spec.ts).
**If you build a new triggered primitive** (a custom drawer, popover, command
palette, etc.), mirror the Modal pattern at
[`a11y-primitives.spec.ts:50-71`](../../../client/e2e/a11y-primitives.spec.ts):

```ts
// client/e2e/a11y-primitives.spec.ts (inside the existing describe block)
test("MyPopover (open state) — zero violations", async ({ page }) => {
  await setThemeAndPreset(page, { theme: "dark", preset: "default" });

  await page.goto("/dashboard/notes");
  await waitForVisualReady(page);

  // 1. Trigger it the way a real user would — no test-only harness.
  await page.getByRole("button", { name: /open notes filter/i }).click();

  // 2. Wait for the open state to actually be in the DOM.
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });

  // 3. Scan the full page (now including the open primitive) and assert zero.
  const violations = await runAxe(page);
  if (violations.length > 0) logFailure("MyPopover", violations);
  expect(violations).toHaveLength(0);
});
```

Trigger via a **real production surface** (a real button label), not a test
harness — that way, if a future refactor breaks the label, the spec fails
loudly with a locator-not-found error instead of silently passing. This is the
discipline the existing Modal spec follows (see its comment at
[`a11y-primitives.spec.ts:44-49`](../../../client/e2e/a11y-primitives.spec.ts)).

> **Prefer composing the shipped primitives.** Before writing a new triggered
> primitive, check whether `<Modal>` or `<Drawer>` (in
> [`client/src/components/ui/`](../../../client/src/components/ui/)) already
> covers your need. They ship focus-trap + ARIA wiring; a hand-rolled portal
> does not. The existing Modal/Toast scans then cover you for free.

---

## 3. Custom-token contrast targets

Adding a 7th theme or re-skinning an existing one means picking new hex values
for the text/surface tokens in
[`client/src/styles/themes.css`](../../../client/src/styles/themes.css). The
file's header literally invites this ("To create a custom theme: copy any
block, change the selector and colors"). The catch: with the cross-theme sweep
deferred ([§1](#1-what-the-template-already-guarantees) caveat), **no
automated test checks a non-default theme's contrast.** You own these bars.

### The WCAG AA bars

| Content | Minimum contrast ratio | WCAG SC |
|---|---|---|
| **Normal text** (< 18.66px / < 24px if bold) | **4.5 : 1** | 1.4.3 (AA) |
| **Large text** (≥ 18.66px bold, or ≥ 24px) | **3 : 1** | 1.4.3 (AA) |
| **Non-text UI** (icons, borders, focus rings, form-input outlines, the active state of a control) | **3 : 1** | 1.4.11 (AA) |

These are the same bars `runAxe` enforces via the `wcag2aa` + `wcag21aa` tags
([`a11y-runner.ts:22`](../../../client/e2e/helpers/a11y-runner.ts)) — you're
just checking them by hand for the cells the matrix doesn't reach.

### The token pairs you must check

Each `[data-theme="..."]` block in `themes.css` defines a text triad over a
surface pair. These are the combinations that actually render, so these are
what you check:

| Foreground token | Background token | Bar | Typical usage |
|---|---|---|---|
| `--text-primary` | `--surface` | 4.5:1 | Body copy, headings on cards |
| `--text-primary` | `--surface-2` | 4.5:1 | Body copy on raised/inset surfaces |
| `--text-secondary` | `--surface` | 4.5:1 | Sub-labels, secondary copy (still real text → 4.5:1, not 3:1) |
| `--text-muted` | `--surface` | 4.5:1 if it's text; 3:1 only if purely decorative | Placeholder / disabled hints — **the most common offender** (see `A11Y_BASELINE.md` "Common offenders") |
| `--primary` / `--accent` | `--surface` | 3:1 (non-text) for borders/icons; 4.5:1 if used as link **text** | Brand buttons, active states, links |
| `--sidebar-text` | `--sidebar-bg` | 4.5:1 | Sidebar nav labels (separate surface) |
| `--danger` / `--success` / `--warning` | `--surface` | 4.5:1 as text, 3:1 as icon/badge | Semantic banners and badges |

> **Why `--text-muted` is the trap:** in the shipped `dark` theme it is
> `#3a3a52` over `--surface: #0e0e1a` — fine for a decorative divider, but if
> you reuse it for *readable* hint text it can fall under 4.5:1. The
> `A11Y_BASELINE.md` recipe for this is "bump the `--text-muted` token in
> `themes.css` for the offending theme." Decide per-theme whether your muted
> token carries text or only decoration, and pick the value accordingly.

### Check a candidate value before you commit it

For each foreground/background pair above:

1. **Compute the ratio.** Paste both hex values into any WCAG contrast checker
   (e.g. the WebAIM Contrast Checker, or your browser DevTools — Chrome's
   color picker shows the AA/AAA pass marks inline when you inspect a text
   node). Confirm it clears the bar from the table.
2. **Account for `rgba()` tokens.** Several tokens (`--primary-light`,
   `--accent-light`, `--sidebar-hover`) are translucent. A checker needs an
   opaque color, so flatten the rgba against its actual backdrop first (the
   surface it sits on), then test the flattened result.
3. **Re-test at large vs. normal sizes.** A value that fails 4.5:1 may pass
   3:1 — but only use the 3:1 lane if that token is genuinely only used for
   large text or non-text UI. Don't downgrade a body-text token to the 3:1
   bar.
4. **Run the gate at your theme.** The default sweep won't catch your theme,
   but you can temporarily flip the cell to your theme to get an axe
   `color-contrast` report:

   ```ts
   // Temporarily, in a11y.spec.ts, to smoke-test your new theme locally:
   await setThemeAndPreset(page, { theme: "your-theme", preset: "default" });
   ```

   Then `pnpm test:e2e --project=a11y -g "<route name>"`. axe's
   `color-contrast` rule reports the exact failing ratio and node. **Revert
   the cell change before committing** — the committed baseline stays on
   `dark`/`default` until the cross-theme matrix lands ([§5](#5-the-cross-theme-matrix-e212-and-e177b)).

When you add a theme, also follow the 6-step "Adding a Theme" recipe in
[`docs/design/css-architecture.md`](../../design/css-architecture.md) so the
47-var contract stays complete — a missing var falls back to `:root` (dark)
and silently breaks contrast on a light theme.

---

## 4. Keyboard + ARIA authoring rules

The template is primitive-first: pages compose
[`client/src/components/ui/`](../../../client/src/components/ui/) and inherit
the ARIA wiring those primitives ship. Follow these DO/DON'T rules for any new
custom component so you don't re-introduce a violation the primitives already
solved.

| Topic | ✅ DO | ❌ DON'T |
|---|---|---|
| **Icon-only buttons** | Add an `aria-label`. Make it translatable via `useTranslation('primitives')` — keys live in [`client/src/locales/{lang}/primitives.json`](../../../client/src/locales/en/primitives.json) (e.g. `modal.close`, `toast.dismiss`). | Ship a bare `<button><Icon/></button>` — axe flags it `button-name`. |
| **Dialogs / overlays** | Use `<Modal>` or `<Drawer>`. They ship `role="dialog"`, `aria-labelledby` (auto-wired from the `title` prop — see [`Modal.tsx:77-79`](../../../client/src/components/ui/Modal.tsx)), and a focus trap. | Hand-roll a portal `<div>`. No focus trap = keyboard users escape into the page behind the overlay. |
| **Live regions** (toasts, async banners) | Use `<Toast>` (it sets `aria-live` — `assertive` for errors, `polite` otherwise, see [`Toast.tsx:58`](../../../client/src/components/ui/Toast.tsx)), or render a `[role="alert"]` banner. | Update on-screen status text with no live-region role — screen readers never announce it. |
| **Form inputs** | Wrap every input in `<FormField>` (it associates `<label for>` + `aria-describedby` for errors). | Use a raw `<input>` with a floating `<span>` label — axe flags `label`. |
| **Tab order** | Keep the logical DOM order: **skip-nav → topbar → nav → main**. The app ships `<SkipNav>` ([`client/src/components/SkipNav.tsx`](../../../client/src/components/SkipNav.tsx)) targeting `#main-content`; give your page's main region that id. | Use `tabindex` > 0 to "fix" order — it desyncs visual and keyboard order. Only `0` / `-1` are acceptable. |
| **Focus visibility** | Let the primitive's focus ring render; if you restyle, keep the ring ≥ 3:1 against its backdrop (non-text contrast, [§3](#3-custom-token-contrast-targets)). | Set `outline: none` without a visible replacement — fails 2.4.7 Focus Visible. |
| **Color as meaning** | Pair color with a label, icon, or shape (e.g. an error banner has both red **and** the word "Error" / an icon). | Convey state by color alone — fails 1.4.1 Use of Color, which axe can't always catch, so this one's on you. |

### i18n + `aria-label` best practice

Accessible names are user-facing strings, so they obey the project's
bilingual rule: every `aria-label` default lives in
`primitives.json` for both `en/` and `zh-TW/`, accessed via
`useTranslation('primitives')`. **Consumer-supplied props always win** over
the i18n default — e.g. a primitive does
`aria-label={props.label ?? t('search.placeholder')}`. So when you author a
custom component:

- Put the default accessible name in **both** `locales/en/primitives.json`
  **and** `locales/zh-TW/primitives.json` (keys identical, values translated).
- Never hard-code an English `aria-label` string in TSX — it won't translate
  and breaks the 繁中-mirror rule.
- Don't duplicate the visible text into the `aria-label` (that double-announces
  for screen-reader users); only label what's otherwise *unnamed* (icon-only
  controls).

---

## 5. The cross-theme matrix (E212 and E177.b)

This guide is the **human** extension playbook. The **machine** backstop — a
sweep that runs every route across all 6 themes × 2 presets instead of the
single `dark`/`default` cell — is tracked separately as the cross-theme a11y
matrix (E212; originally scoped as E177.b in
[`A11Y_BASELINE.md`](../../design/A11Y_BASELINE.md) "Out of scope"). The two
are complementary:

- **Until that matrix lands**, the manual contrast checks in [§3](#3-custom-token-contrast-targets)
  are your *only* guard for non-default themes — do them.
- **Once it lands**, your new theme's tokens get scanned automatically across
  every route, and this guide's §3 becomes the "why" behind the failures the
  matrix reports.

E215 (this guide) does **not** depend on that matrix shipping — treat the
reference as a forward note. If you've already pulled the cross-theme matrix
into your fork, point your CI at it and you get §3 enforced for free.

---

## 6. Debug a violation in your fork

When the `[a11y]` gate fails, don't reach for a suppression — fix the
primitive. The full debugging playbook (read the `formatViolations()` log →
reproduce in-browser → fix the **primitive not the page** → re-run `-g
"<test>"` → add a unit test) lives in
[`docs/design/A11Y_BASELINE.md`](../../design/A11Y_BASELINE.md) under "How to
debug a violation" and "Common offenders + recipes". That doc is the source of
truth for fixing a *failing* scan; this guide is for *extending* the scan to
your new surfaces.

---

## Out of scope (same boundaries as E177)

- **Manual screen-reader testing** (NVDA / JAWS / VoiceOver) — a human-gated
  follow-up; axe-core does not replace it.
- **WCAG AAA** — AA is the bar; AAA blocks too many palette choices.
- **Cognitive a11y** (reading-level, attention, memory) — outside axe-core's
  scope.

---

## See also

- [`docs/design/A11Y_BASELINE.md`](../../design/A11Y_BASELINE.md) — the a11y
  contract, debug recipes, and suppression policy (the source of truth this
  guide extends).
- [`e2e-testing.md`](e2e-testing.md) — running the Playwright suite, including
  the `[a11y]` project, locally and in CI.
- [`fork-security-setup.md`](fork-security-setup.md) — the sibling
  fork-enablement guide (secrets + OWASP) from the same cycle.
- Source of truth for the machinery this guide describes:
  [`client/e2e/helpers/a11y-runner.ts`](../../../client/e2e/helpers/a11y-runner.ts),
  [`client/e2e/a11y.spec.ts`](../../../client/e2e/a11y.spec.ts),
  [`client/e2e/a11y-primitives.spec.ts`](../../../client/e2e/a11y-primitives.spec.ts),
  [`client/src/styles/themes.css`](../../../client/src/styles/themes.css).
