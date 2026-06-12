---
name: design-system
description: >
  Design system rules for this React project. Use this skill whenever adding a page,
  styling a component, generating a TSX page, working with @designer, running
  /athena:design, or composing any new UI. Covers the primitive-first rule,
  Stop-verifier Rule #21/#22 constraints, Preset axis, Theme axis, and token
  canonical sources. Trigger phrases: "add a page", "style a", "new page",
  "tsx page", "@designer", "new component", "generate page".
---

# Design System — AI-Coding-Template

## Primitive-First Rule (mandatory)

Every page and feature composes `components/ui/` primitives. Never write
raw HTML elements styled with ad-hoc CSS when a primitive exists.

```typescript
// Correct — compose primitives
import { Card, Stack, PageHeader, Button } from '@/components/ui';

// Wrong — raw elements with CSS classes or inline styles from scratch
<div style={{ display: 'flex', gap: 16 }}>
```

## Stop-Verifier Constraints (enforced, will block completion)

- **Rule #21** — NO new files matching `client/src/pages/**/*.css`.
  Page-co-located CSS is banned. Any new `Page.css` / `<slug>.css` will fail
  the stop-verifier immediately.
- **Rule #22** — NO new CSS selectors added to `client/src/styles/common/*.css`.
  New visual rules belong in `components/ui/<Name>.tsx` Preset slots, not common/.

## Canonical Token Sources

| Source | Purpose |
|--------|---------|
| `docs/design/design-system.css` | Reference — all token names and their semantics |
| `client/src/styles/themes.css` | Per-theme overrides — 6 themes × 47 CSS vars each |

Do NOT reference `client/src/styles/common/` as a token source — it is near-empty
after E170–E178 trims and contains only legacy residue.

## Styling Approach (in priority order)

1. **Tailwind utility classes** on JSX elements for layout and spacing:
   ```tsx
   <div className="flex flex-col gap-4 p-6">
   <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
   ```

2. **Compose `components/ui/` primitives** for cards, headers, buttons, forms:
   ```tsx
   import { Card, Stack, PageHeader, Button, StatCard } from '@/components/ui';

   <PageHeader title="Blog Posts" subtitle="Manage your content" />
   <Stack direction="column" gap={4}>
     <Card>...</Card>
   </Stack>
   ```

3. **Preset slots** via `components/ui/preset.ts` for variant-driven visual control:
   ```typescript
   import { defaultPreset, compactPreset, editorialPreset, densePreset } from '@/components/ui/preset';
   // Use preset props on primitives — e.g. <Card preset={compactPreset}>
   ```

4. **Theme CSS vars** via Tailwind `[var(--token)]` syntax when a semantic token
   is needed that Tailwind doesn't cover:
   ```tsx
   <p className="text-[var(--text-secondary)] text-sm">
   ```

## Preset Axis

`components/ui/preset.ts` exports 4 presets:
- `defaultPreset` — standard spacing and typography
- `compactPreset` — tighter spacing for data-dense views
- `editorialPreset` — larger type, generous whitespace for content pages
- `densePreset` — maximum density for admin/table views

See `docs/design/PRESET_RECIPES.md` for usage cookbook.

## Theme Axis

`client/src/styles/themes.css` defines 6 themes via `[data-theme]` selectors:
`dark` (default), `indigo`, `navy`, `sage`, `rose`, `forest`

Each theme provides 47 CSS vars: `--primary`, `--accent`, `--surface`,
`--surface-2`, `--text-primary`, `--text-secondary`, `--border`, `--danger`,
`--sidebar-*`, plus semantic and legacy aliases.

## 40 Available Primitives (`components/ui/`)

Key primitives: `Banner`, `Button`, `Card`, `DropdownMenu`, `NavItem`,
`PageHeader`, `PasswordField`, `SocialButtons`, `Stack`, `StatCard`, and 30+
more. Run `ls client/src/components/ui/*.tsx` for the full list before
creating any new primitive — reuse first.

## Quick Reference — Generating a New Page

```tsx
// client/src/pages/my-feature/MyFeaturePage.tsx
import { Card, PageHeader, Stack } from '@/components/ui';

export function MyFeaturePage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title="My Feature" subtitle="Description here" />
      <Stack direction="column" gap={4}>
        <Card>
          {/* content */}
        </Card>
      </Stack>
    </div>
  );
}
// No .css import. No co-located CSS file. No styles/common/ additions.
```
