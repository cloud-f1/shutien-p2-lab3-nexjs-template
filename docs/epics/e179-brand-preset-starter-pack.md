# E179 — Brand Preset Starter Pack + Recipe Cookbook

> Phase 44 — Design System Completion & Validation | Size: S (2 SP) | Deps: E167

## Problem

The Preset axis (E167) ships with `defaultPreset` and `compactPreset`. That's enough to *prove* the swap mechanism, but a fork that wants to rebrand has only one alternative reference (`compact`) — and `compact` differs from `default` only in *density*, not in *style*.

A new fork asking "how do I make this look like a different SaaS?" has to:
1. Read the entire `Preset` interface (now ~25 slots after Phase 44)
2. Read both `default` and `compact` to see how slots cascade
3. Invent a third style direction from scratch

That's a long ramp. We claim "rebrand in one step" but the on-ramp is 2 hours, not 5 minutes.

## Solution

Ship two opinionated brand presets that demonstrate the *style axis* (not just density) and a cookbook documenting how to author a brand preset.

### `editorialPreset` — magazine-style

- Serif display font (`var(--font-serif, "DM Serif Display")`)
- Generous whitespace (header padding doubled vs default)
- Larger type scale (title `text-4xl md:text-5xl`)
- Pill-shaped buttons (`rounded-full`)
- Breadcrumb separator: `›` instead of `/`
- Subtle borders, more shadow
- Primary use case: content-heavy SaaS, marketing, editorial dashboards

### `densePreset` — Bloomberg-terminal style

- Mono everywhere (`var(--font-mono)`)
- Compact gridlines (`<th>` and `<td>` padding 4px instead of 12px)
- Right-aligned numerics by default in `<DataTable>`
- Sharper corners (`rounded-sm` everywhere)
- Smaller type scale (text-xs base)
- High info density — fits twice the rows per viewport
- Primary use case: trading, ops dashboards, data analytics

### Recipe cookbook — `docs/design/PRESET_RECIPES.md`

Structured walkthrough:

1. **Pick a style direction** — give 3 example inspirations: magazine, terminal, OS-native
2. **Map the direction to Preset slots** — table cross-referencing direction → which slots matter most (e.g. magazine → font + spacing + radii; terminal → font + table density)
3. **Spread + override pattern** — copy `defaultPreset`, override only the slots that differ from your direction
4. **Test your preset** — wrap your app in a test that runs the existing primitive test suite under your preset; failures = your preset is incomplete
5. **Ship as a `.ts` file** — convention: `client/src/components/ui/presets/<name>.ts`
6. **Optional: a la carte** — show how to compose from multiple presets (`{ ...editorialPreset.button, ...densePreset.table }`)

## Key Files

| File | Action |
|---|---|
| `client/src/components/ui/presets/editorial.ts` | New — `editorialPreset` |
| `client/src/components/ui/presets/dense.ts` | New — `densePreset` |
| `client/src/components/ui/preset.ts` | Edit — re-export the two new presets so `import { editorialPreset } from "@/components/ui"` works |
| `client/src/components/ui/index.ts` | Edit — barrel re-export |
| `client/src/components/ui/__tests__/presets-extra.test.tsx` | New — load each new preset, assert it round-trips through `setActivePreset` and changes one telltale class on a primitive |
| `docs/design/PRESET_RECIPES.md` | **New** — cookbook (target ~150 lines) |
| `docs/design/design.md` | Edit — § 9 expanded "Two presets ship" → "Four presets ship" + link to PRESET_RECIPES.md |
| `client/src/pages/LandingPage.tsx` (or wherever the theme picker is) | Edit — optional: add a preset picker so users can demo all 4 presets live |

## Implementation

1. Author `editorialPreset` by spreading `defaultPreset` and overriding slots: button (rounded-full + larger padding), pageContainer (larger title), breadcrumb (chevron glyph), card (more shadow). Keep the slot count complete.
2. Author `densePreset` similarly — table (tight padding), button (smaller), pageContainer (smaller title), filter/search (smaller).
3. Test both presets — render `<Button>` + `<DataTable>` under each and assert the rendered class strings differ from `defaultPreset` in the expected slots.
4. Author `PRESET_RECIPES.md`:
   - Section 1: "Why a preset, not a theme?" — explain the orthogonal axes
   - Section 2: "Three example directions" — magazine / terminal / OS
   - Section 3: "Slot map by direction"
   - Section 4: "Step-by-step author flow" with code
   - Section 5: "A la carte composition"
   - Section 6: "Testing your preset"
5. Update `design.md` § 9 to link to the cookbook.
6. Optional: extend `LandingPage` theme picker to also pick a preset (live demo of the 2-axis system).

## Acceptance Criteria

- [ ] `editorialPreset` and `densePreset` shipped, full slot coverage (TypeScript-enforced via `Preset` interface)
- [ ] Both presets covered by tests that prove they swap rendered classes
- [ ] `PRESET_RECIPES.md` written — a new contributor can author their own preset following the recipe
- [ ] design.md § 9 updated; new presets discoverable from the design system entry doc
- [ ] All client tests pass; build green
- [ ] Optional landing-page preset picker doesn't break theme picker
- [ ] No new hardcoded Tailwind class strings outside `presets/*.ts` and `preset.ts` (audit grep passes)

## Alignment / Cross-Epic Hooks

- **Hard-depends on E167** — uses the Preset axis as designed.
- **Soft-pairs with E165** (rose + forest themes) — themes (color/font) and presets (shape/density) are complementary; this epic shows the latter the same way E165 expanded the former.
- **Validates E173–E175 + E178** — when those epics add new Preset slots, this epic's two extra presets must be updated too. Catches "forgot to update alt presets" early.
- **Closes the "rebrand in 5 minutes" promise** with two working examples instead of one density variant.

## Out of Scope

- **A figma plugin / design-tool exporter** — separate concern; preset.ts is already a JSON-like object, scripts can serialize it later.
- **Brand-asset bundling** (logos, fonts) — presets handle classes/glyphs only; brand assets are page-level content.
- **Industry-vertical presets** ("healthcare", "fintech", "edtech") — too prescriptive; the cookbook teaches the pattern, forks pick their own direction.
- **Preset versioning / migration tooling** — defer until two presets need a coordinated update.
- **Per-route preset overrides** — `setActivePreset` is global; per-route is unusual and out of scope.
