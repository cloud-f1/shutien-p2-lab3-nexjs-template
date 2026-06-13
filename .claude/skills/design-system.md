---
name: design-system
description: >
  Design system rules for this Next.js project. Use this skill whenever adding a page,
  styling a component, generating a TSX page, working with @designer, running
  /athena:design, or composing any new UI. Covers the primitive-first rule,
  Stop-verifier Rule #21/#22 constraints, shadcn/ui component usage, Tailwind CSS v4 dark
  mode, and token canonical sources. Trigger phrases: "add a page", "style a", "new page",
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

- **Rule #21** — NO new co-located `*.css` files alongside page components.
  Page-co-located CSS is banned. Any new `Page.css` / `<slug>.css` will fail
  the stop-verifier immediately.
- **Rule #22** — NO new CSS selectors added to shared global CSS files.
  New visual rules belong in `components/ui/<Name>.tsx` Tailwind classes, not global CSS.

## Canonical Token Sources

| Source | Purpose |
|--------|---------|
| `docs/design/design-system.css` | Reference — all token names and their semantics |
| `next-app/app/globals.css` | Global styles + Tailwind CSS v4 directives + CSS custom properties |

Do NOT add new design tokens or CSS vars outside `globals.css` — use Tailwind utility classes
and `dark:` variants for everything else.

## Styling Approach (in priority order)

1. **Tailwind utility classes** on JSX elements for layout and spacing:
   ```tsx
   <div className="flex flex-col gap-4 p-6">
   <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
   ```

2. **Compose shadcn/ui components** from `next-app/components/ui/` for cards, buttons, forms, etc.:
   ```tsx
   import { Card, CardHeader, CardContent } from '@/components/ui/card';
   import { Button } from '@/components/ui/button';
   ```

3. **Dark mode** via `dark:` Tailwind variants — `next-themes` class strategy is configured in
   `next-app/components/theme-provider.tsx`. Never use `style=` color overrides.

4. **CSS custom properties** via Tailwind `[var(--token)]` syntax when a semantic token
   is needed that Tailwind doesn't cover:
   ```tsx
   <p className="text-[var(--text-secondary)] text-sm">
   ```

## Theme Axis

`next-app/app/globals.css` defines CSS custom properties used by shadcn/ui and the theme system.
Toggle between light/dark with `next-themes` — keyboard shortcut `d` is wired in
`next-app/components/theme-provider.tsx`.

## Available shadcn/ui Components (`components/ui/`)

These are installed via `npx shadcn@latest add <component>` and live in `next-app/components/ui/`.
Run `ls next-app/components/ui/` for the full list before creating any new primitive — reuse first.
NEVER hand-author files in `components/ui/` — always use the shadcn CLI.

## Quick Reference — Generating a New Page

```tsx
// next-app/app/(dashboard)/my-feature/page.tsx  — Server Component by default
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function MyFeaturePage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">My Feature</h1>
      <Card>
        <CardHeader><CardTitle>Section</CardTitle></CardHeader>
        <CardContent>
          {/* content */}
        </CardContent>
      </Card>
    </div>
  );
}
// No .css import. No co-located CSS file. No globals.css additions.
```
