# Preset Recipes — A Cookbook for Brand Skins

> **Audience:** anyone forking this template who wants the app to look unlike
> the default.
> **Foundation:** the Preset axis (`client/src/components/ui/preset.ts`)
> shipped in **E167**. This cookbook (E179) shows how to *use* it.

---

## 1. Why does the Preset axis exist?

The design system has **two orthogonal axes**:

| Axis | What it changes | Where it lives |
|---|---|---|
| **Theme** | colors, fonts (CSS vars), shadows, radii tokens | `client/src/styles/themes.css` (`[data-theme=...]`) |
| **Preset** | layout density, class strings, glyphs, variant maps | `client/src/components/ui/preset.ts` + `presets/*.ts` |

Themes change *what color a button is*. Presets change *what shape a button
is*, *how much padding a card has*, *whether a breadcrumb separator is `/`
or `›`*. They compose freely — the same theme works under any preset, the
same preset works under any theme.

A fork that wants to feel like a different SaaS product almost always
needs **both** axes — a brand color set (theme) plus a brand shape language
(preset). Themes are documented in
[`docs/design/css-architecture.md`](./css-architecture.md) §
"Adding a Theme". This file documents the preset side.

## 2. What ships out of the box

| Preset | Style | Use case |
|---|---|---|
| `defaultPreset` | balanced — mono labels, soft borders, generous spacing | the canonical template look |
| `compactPreset` | denser tables + smaller buttons, otherwise like default | data-heavy admin pages |
| `editorialPreset` | serif titles, generous whitespace, pill buttons, square cards, accent-first | content / marketing / publication SaaS |
| `densePreset` | mono-everywhere, sharp corners, tightest table padding (~2px) | trading dashboards, ops consoles, analytics terminals |

All four are exported from `client/src/components/ui`:

```ts
import {
  defaultPreset,
  compactPreset,
  editorialPreset,
  densePreset,
  setActivePreset,
} from "@/components/ui";
```

## 3. Consuming a preset

A preset becomes "the app's skin" by calling `setActivePreset` once at boot:

```tsx
// client/src/main.tsx (or a top-level provider)
import { setActivePreset, editorialPreset } from "@/components/ui";

setActivePreset(editorialPreset);
```

Every primitive in `components/ui/` reads from `getActivePreset()` on render,
so the swap is global and instant. No primitive needs editing.

To revert during a test:

```ts
import { resetActivePreset } from "@/components/ui";
afterEach(() => resetActivePreset());
```

## 4. Recipes

### Recipe A — "Make every primitive use serif fonts"

The default preset uses `font-display` (sans) for titles and `font-body`
(sans) for body. To go full serif, override the typography slots:

```ts
// client/src/presets/serif.ts
import { defaultPreset, type Preset } from "@/components/ui";

export const serifPreset: Preset = {
  ...defaultPreset,
  name: "serif",
  pageContainer: {
    ...defaultPreset.pageContainer,
    title: "font-display text-2xl md:text-3xl font-bold text-text-primary mt-1",
    subtitle: "font-display text-sm text-text-secondary mt-2 max-w-2xl",
  },
  card: {
    ...defaultPreset.card,
    title: "font-display text-base font-semibold text-text-primary",
  },
  prose: {
    shell: defaultPreset.prose.shell.replace(/font-mono/g, "font-display"),
  },
};
```

Then ensure `font-display` is bound to a serif family in your theme block
(in `themes.css`): `--font-display: "DM Serif Display", Georgia, serif;`.

### Recipe B — "Add brand-colored buttons"

Override the `button.variants` slot:

```ts
import { defaultPreset, type Preset } from "@/components/ui";

export const brandPreset: Preset = {
  ...defaultPreset,
  name: "acme-brand",
  button: {
    ...defaultPreset.button,
    variants: {
      ...defaultPreset.button.variants,
      primary:
        "bg-[#FF5722] text-white border-[#FF5722] hover:bg-[#F4511E] hover:shadow-md",
    },
  },
};
```

For best results, drive the brand color through a CSS variable in your
theme block instead of hardcoding hex (cleaner, swaps under dark mode):

```css
[data-theme="acme"] {
  --primary: #ff5722;
  --primary-dark: #f4511e;
  /* ... */
}
```

Then your preset can use `bg-primary` / `border-primary` and let the
theme axis handle the value.

### Recipe C — "Compact admin dashboard"

Use the shipped `compactPreset` (or `densePreset` if you want the
Bloomberg-terminal feel):

```tsx
import { setActivePreset, compactPreset } from "@/components/ui";
setActivePreset(compactPreset); // denser tables + smaller buttons

// Or even tighter:
import { densePreset } from "@/components/ui";
setActivePreset(densePreset); // mono-everywhere, ~2px table padding
```

`densePreset` fits roughly 2× the rows per viewport vs `defaultPreset`.

### Recipe D — "Editorial / publication style"

Use the shipped `editorialPreset`:

```tsx
import { setActivePreset, editorialPreset } from "@/components/ui";
setActivePreset(editorialPreset);
```

What you get:

- **Pill buttons** (`rounded-full`)
- **Larger hero titles** (`text-5xl md:text-7xl`)
- **Square feature cards** (`rounded-none`, hairline border, no shadow)
- **Chevron breadcrumb separator** (`›` not `/`)
- **Accent-first emphasis** — primary buttons render with `--accent`, not `--primary`
- **Magazine prose** — `font-display` paragraphs, `text-lg`, `leading-[1.75]`

Pairs especially well with the `rose` theme (warm editorial) or `sage`
theme (calm botanical).

### Recipe E — À la carte composition

Presets are plain objects. Combine slots from multiple presets:

```ts
import { editorialPreset, densePreset, type Preset } from "@/components/ui";

export const editorialAdminPreset: Preset = {
  ...editorialPreset,                    // editorial chrome (nav, hero, prose)
  table: densePreset.table,              // but dense tables for the data
  pagination: densePreset.pagination,    // and dense pagination
  name: "editorial-admin",
};
```

This is the "magazine front page + Bloomberg back office" combo — a
common pattern for content businesses with admin tooling.

### Recipe F — Authoring a brand preset from scratch

1. **Pick a style direction.** Three reference inspirations:
   - *Magazine* — serif titles, generous whitespace, square corners → see `editorialPreset`
   - *Terminal* — mono everywhere, sharp corners, dense → see `densePreset`
   - *OS-native* — system fonts, native radii, default macOS feel → not yet shipped
2. **Map the direction to slots.** Use the table below as a starting point.
3. **Spread + override.** `{...defaultPreset, name: "...", <slot>: {...}}`
4. **Land in `client/src/components/ui/presets/<name>.ts`.**
5. **Re-export from `preset.ts`** so `import { yourPreset } from "@/components/ui"` works.
6. **Add to `presets-integrity.test.tsx`** so the integrity check covers your preset.

#### Slot map by style direction

| Style direction | Slots that matter most |
|---|---|
| Magazine | `button`, `pageContainer.title`, `heroSection`, `card`, `prose`, `breadcrumb.separatorGlyph` |
| Terminal | `button`, `table` (th/td/toolbar), `pagination`, `formField`, `card.shell` (rounded-sm) |
| OS-native | `button.sizes`, `card.paddings`, `modal.shell`, `drawer.shell` |
| Brand-color-only | `button.variants`, `tabs.triggerActive`, `pagination.button.active` |
| Density-only | every padding-bearing slot — see `compactPreset` for the recipe |

## 5. Testing your preset

Two layers of safety:

1. **TypeScript** — type your export `: Preset` and the compiler will refuse
   missing slots:
   ```ts
   export const myPreset: Preset = { ... }; // tsc errors if a slot is missing
   ```
2. **Integrity test** — add your preset to `SHIPPED_PRESETS` in
   `client/src/components/ui/__tests__/presets-integrity.test.tsx`. The
   test suite asserts every required key is present and that
   `setActivePreset` round-trips. This catches accidental `as Preset`
   casts that bypass TypeScript.

For a stronger guarantee, run the existing primitive test suites
(`Button.test.tsx`, `DataTable.test.tsx`, etc.) under your preset by
wrapping them with `setActivePreset(yourPreset)` in `beforeEach`. Any
DOM-level test failure means your preset is missing a class the
primitive expects.

## 6. Suggested viewports for QA

When eyeballing a brand preset, sweep these viewports — different presets
target different reading distances:

| Viewport | Use to verify |
|---|---|
| 1440 × 900 | Editorial landing page proportions, hero, feature grid |
| 1280 × 720 | Default dashboard layout, table density |
| 1024 × 768 | Tablet — drawer / modal sizing |
| 375 × 667 | Mobile — nav burger, card stacking |

A working preset should look intentional at all four viewports. If it
breaks at 375px, the slot most likely needs a `sm:` / `md:` Tailwind
prefix in the override.

## 7. Where to next

- **Add a brand theme** alongside your brand preset — see the 6-step recipe
  in [`docs/design/css-architecture.md`](./css-architecture.md) §
  "Adding a Theme".
- **Wire a preset picker** into your settings page so users can swap at
  runtime (the template's Theme picker is the model — clone the pattern
  for presets).
- **Publish your preset as an npm package** — presets are pure data, so
  they ship as a single `.ts` file with zero runtime dependencies.

The promise is: *rebrand in five minutes*. Two presets in two paragraphs
is the proof.
