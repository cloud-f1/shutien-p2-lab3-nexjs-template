# CSS Architecture Guide

> Post-wave-2 (Phase 43) layout. The styling system has three axes:
> **theme** (CSS variables) × **preset** (component recipes) × **primitive**
> (`components/ui/` React component). Tailwind utilities are the base.

---

## 1. Tailwind as the Base

Tailwind 3 with `preflight: false` is enabled in `tailwind.config.ts` and
imported once in `client/src/styles/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

The Tailwind theme bridges to the CSS-variable contract from `themes.css`,
so utilities like `bg-surface` or `text-text-primary` resolve to the
active theme automatically. **All new component styling goes through
Tailwind utilities** — composed by the preset layer (see §2).

## 2. `components/ui/` Primitives + Preset Axis (E167)

Every shared piece of UI (buttons, inputs, banners, cards, layouts,
modals, tables…) lives as a React primitive in `client/src/components/ui/`.
The primitive does not hard-code its Tailwind classes — it pulls them
from the **active preset** via `getActivePreset()`:

```tsx
// components/ui/Button.tsx (excerpt)
const p = getActivePreset().button;
return <button className={[p.shell, p.variants[variant]].join(" ")}>...
```

`preset.ts` defines the default preset (matches the dark theme look) and
exports `setActivePreset` for design-system swaps. The compact preset is
shipped as a working second preset; new presets just need to satisfy
the `Preset` interface.

**Brand presets (E179):** four presets ship out of the box — `defaultPreset`,
`compactPreset` (denser tables), `editorialPreset` (magazine-style: serif
titles, pill buttons, square cards, chevron breadcrumbs), and `densePreset`
(Bloomberg-terminal: mono everywhere, ~2px table padding). Each preset
lives in its own file under `client/src/components/ui/presets/<name>.ts`
and inherits one-directionally (editorial spreads default; dense spreads
compact). The full author recipe — slot maps by style direction, à la
carte composition, and testing — is documented in
[`PRESET_RECIPES.md`](./PRESET_RECIPES.md).

**Rule:** never write a TSX page that hand-rolls Tailwind for shared
patterns — go through a primitive. If the primitive doesn't exist yet,
add one (see `@designer` agent + `/athena:design`).

## 3. `themes.css` — 6-Theme Axis

`client/src/styles/themes.css` defines six themes as `[data-theme="..."]`
blocks: dark (default), indigo, navy, sage, rose, forest. Each theme
implements the full **47-variable contract** (Primary / Accent /
Semantic / Surfaces / Text / Sidebar / Legacy aliases). Adding a theme
follows the 6-step recipe in [Adding a Theme](#adding-a-theme) below.

`fonts.css` carries the Google Fonts imports; both files are imported
once at the top of `globals.css`.

**Rule:** never hardcode colors in TSX or CSS. Read tokens via
`var(--...)` or via the Tailwind alias (`bg-primary`, `text-text-muted`).
Stop-verifier Rule #17 enforces this.

## 4. `styles/common/` — Minimal Residue

After E170 the `client/src/styles/common/` directory holds **only the
rules a primitive still consumes**:

| File | What's left | Why |
|---|---|---|
| `buttons.css` | empty (header comment only) | All `.btn-*` rules removed — `<Button>` covers them |
| `forms.css` | `.form-banner` (referenced by Banner preset) + `.form-toggle*` (gated on E173) | Other `.form-*` rules removed |
| `cards.css` | `.c-card`, `.c-panel`, `.c-badge*`, `.c-stat*` (gated on E178) | Will be removed when `<Card>` ships |

**Rule:** do not add new rules to `styles/common/`. New shared styling
goes into a primitive + its preset entry.

## 5. Page-Level CSS — None

After E168 / E169 / E170:

- No `*.css` files under `client/src/pages/` (every migrated page renders
  through `components/ui/` primitives + Tailwind).
- The only page-adjacent CSS file is `components/DashboardLayout.css`,
  which is owned by E175 (`DashboardLayout` decomposition) — out of
  scope for E170.

**Rule:** do not create page-co-located CSS. If a page needs a layout
that primitives can't express, extract a primitive first.

---

## Adding a Theme

> Step-by-step process for shipping a brand-new theme end-to-end.
> Every theme must implement the **full 47-variable contract** — partial
> themes break the legacy alias chain and Stop-verifier Rule #17 (CSS var
> drift) will block the merge.
>
> **Reference**: rose + forest themes landed via E165 are good templates
> if you want a working example to crib from.

### Step 1 — Define the `[data-theme="<name>"]` block

In `client/src/styles/themes.css`, copy the entire `[data-theme="dark"]`
block (it is the canonical 47-var contract — every other theme matches
its variable list exactly) and rename the selector:

```css
[data-theme="<name>"] {
  /* Primary */
  --primary: ...;
  --primary-dark: ...;
  --primary-light: ...;
  --primary-bg: ...;

  /* Accent */
  --accent: ...;
  --accent-light: ...;

  /* Semantic */
  --success: ...;
  --success-light: ...;
  --warning: ...;
  --warning-light: ...;
  --danger: ...;
  --danger-light: ...;

  /* Surfaces */
  --bg: ...;
  --surface: ...;
  --surface-2: ...;
  --border: ...;

  /* Text */
  --text-primary: ...;
  --text-secondary: ...;
  --text-muted: ...;

  /* Sidebar / Nav */
  --sidebar-bg: ...;
  --sidebar-text: ...;
  /* ... */

  /* Legacy aliases (REQUIRED — older CSS still reads these) */
  --amber: ...;
  --white: ...;
  --gray: ...;
  --gray2: ...;
  /* ... */
}
```

Then change every value. Keep the variable **list** intact — only the
values change. If you skip a var, the dark fallback leaks through and
the theme looks visually broken on pages that rely on the missing token.

### Step 2 — Extend the `Theme` union in `ThemeProvider.tsx`

In `client/src/components/ThemeProvider.tsx`, add the new id to the
TypeScript union so downstream consumers get type-safe completion:

```ts
type Theme = "dark" | "indigo" | "navy" | "sage" | "rose" | "forest" | "<name>" | "system";
```

### Step 3 — Register in `VALID_THEMES` + `THEME_OPTIONS`

Same file, two additions:

```ts
const VALID_THEMES = new Set<Theme>([
  "dark", "indigo", "navy", "sage", "rose", "forest", "<name>", "system",
]);

export const THEME_OPTIONS: { value: Theme; label: string }[] = [
  // ...existing entries...
  { value: "<name>", label: "<Display Label>" },
];
```

`VALID_THEMES` is the runtime guard for the persisted Zustand store
(rejects garbage from `localStorage`); `THEME_OPTIONS` is what the
Settings dropdown renders.

### Step 4 — Add a `THEME_CARDS` entry in `LandingPage.tsx`

In `client/src/pages/LandingPage.tsx`, find the `THEME_CARDS` array
and add an entry with id, label, and a 4-color swatch (these drive
the landing-page theme preview tiles):

```ts
{
  id: "<name>" as const,
  label: "<Display Label>",
  swatch: ["#hex1", "#hex2", "#hex3", "#hex4"],
},
```

### Step 5 — Add a `data-theme` assertion test

In `client/src/components/__tests__/ThemeProvider.test.tsx`, add one
assertion mirroring the existing rose/forest tests, and bump the
"renders all options" count by one so the option-count assertion
matches `THEME_OPTIONS.length`:

```ts
it("sets data-theme to <name> when theme is <name>", () => {
  useThemeStore.setState({ theme: "<name>" });
  render(<ThemeProvider><div /></ThemeProvider>);
  expect(document.documentElement.getAttribute("data-theme")).toBe("<name>");
});
```

### Step 6 — Verify (no drift, all tests green)

Run the drift check + the focused test suite:

```bash
bash scripts/checks/css-var-check.sh
cd client && pnpm test:run -- ThemeProvider
```

`css-var-check.sh` enforces Stop-verifier Rule #17 — any variable
referenced in a component but not defined in your new block will
fail the gate. Fix by adding the missing var to the new block (do
not delete the reference — it is shared with other themes).
