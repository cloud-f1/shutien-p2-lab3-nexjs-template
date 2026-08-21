---
name: design-system
description: >
  Design system rules for this Next.js project. Use this skill whenever adding a page,
  styling a component, generating a TSX page, working with @designer, running
  /athena:design, or composing any new UI. Covers the primitive-first rule,
  Stop-verifier rule constraints, shadcn/ui component usage, Tailwind CSS v4 dark
  mode, and token canonical sources. Trigger phrases: "add a page", "style a", "new page",
  "tsx page", "@designer", "new component", "generate page".
---

# Design System — AI-Coding-Template

## Primitive-First Rule (mandatory)

Every page and feature composes `components/ui/` primitives. Never write
raw HTML elements styled with ad-hoc CSS when a primitive exists.

```typescript
// Correct — compose primitives, per-file shadcn imports
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Wrong — raw elements with CSS classes or inline styles from scratch
<div style={{ display: 'flex', gap: 16 }}>
```

## Stop-Verifier Constraints (enforced, will block completion)

The stop-verifier's current structural rule set (see `scripts/hooks/CLAUDE.md` for the full
table) — the ones most relevant to UI work:

- **Rule 1** — no inline `style=` color overrides; use Tailwind + `dark:` variants.
- **Rule 2** — mutating Server Actions must carry an RBAC guard.
- **Rule 3** — list/table views use the reusable `<DataTable>`, never a hand-rolled `<table>`.
- **Rule 4** — no `console.log` residue in committed code.
- **Rule 5** — no hand-authored files in `components/ui/` — always use the shadcn CLI.
- **Rule 23** — verification discipline: a `verification_check` audit event must exist before
  a `feat:`/`fix:`/`refactor:`/`perf:`/`test:`/`style:` commit (see the `verification-discipline` skill).

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

## StatusBadge Tones

`components/status-badge.tsx` (E262) is the semantic status pill — pair with a live-dot for
real-time states. Its `TONES` map is the canonical tone set; use exactly these five (module-private,
not exported — the component's `tone` prop type is derived from it):

| Tone | Semantic use | Token classes |
|---|---|---|
| `success` | completed / healthy / passing | `text-success border-success/30 bg-success/10` |
| `warning` | attention needed / pending / degraded | `text-warning border-warning/30 bg-warning/10` |
| `info` | neutral informational state | `text-info border-info/30 bg-info/10` |
| `danger` | failed / error / destructive state | `text-destructive border-destructive/30 bg-destructive/10` |
| `muted` | inactive / default / no strong signal | `text-muted-foreground border-border bg-transparent` |

This tone list is pinned against the actual `TONES` object in
`next-app/lib/doc-contract.test.ts` (E341) — if you add, remove, or rename a tone, update
BOTH `status-badge.tsx` and this table in the same change, or `pnpm test doc-contract` goes red.

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
