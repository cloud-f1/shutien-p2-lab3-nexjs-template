---
description: "(ui) Generate a Next.js page → design tokens + @designer → page.tsx + smoke test. Usage: `<slug> \"<description>\"`."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---

Parse the user's input: $ARGUMENTS

The first argument is the page **slug** in kebab-case (e.g. `user-settings`,
`billing-portal`). Everything after the first whitespace-separated token is
the **description** — usually quoted.

Optional flags:

- `--layout=dashboard|auth|none` — which route group to place the page in
  (default: `dashboard`). `dashboard` → `app/(dashboard)/dashboard/<slug>/page.tsx`
  (URL `/dashboard/<slug>` — matches the canonical `items` pattern's URL space),
  `auth` → `app/(auth)/<slug>/page.tsx`, `none` → `app/<slug>/page.tsx`.
- `--blueprint=<path>` — optional path to an HTML blueprint under `docs/blueprints/`
- `--ref=<path>` — optional path to a reference image (treated as guidance only;
  this command does not require multi-modal input)

Examples:

```
/athena:design user-settings "Tab-based settings page with profile, notifications, billing tabs; place under the dashboard layout"
/athena:design billing-portal "Stripe-style invoice list with status pills" --layout=dashboard
/athena:design hero-cta "Marketing hero with CTA button" --layout=none --blueprint=docs/blueprints/hero.html
```

If `$ARGUMENTS` is empty OR the slug is missing, respond with the usage
example above and STOP — do not invoke @designer with empty input.

If the slug is not kebab-case (contains uppercase, underscores, or spaces),
normalize it to kebab-case before passing to @designer and warn the user
about the rename.

## Invoke @designer

Pass the parsed inputs as a JSON object via the Agent tool, asking @designer
to produce the deliverables defined in `.claude/agents/designer.md`:

```
Inputs:
  slug: "<parsed-slug>"
  description: "<parsed-description>"
  layout: "<dashboard|auth|none, default dashboard>"
  blueprint_path: "<optional path or null>"
```

@designer will:

1. Read the canonical design tokens (`next-app/app/globals.css` Tailwind v4
   `@theme` block; `app/cobalt-fx.css` for optional effect layers) and the
   installed shadcn primitive set (`ls next-app/components/ui/` — there is no
   `index.ts` barrel and no `preset.ts`)
2. Ask one batched clarifying question if critical info is missing, then
   proceed
3. Write `page.tsx` at the layout-derived route path (e.g.
   `next-app/app/(dashboard)/dashboard/<slug>/page.tsx` for the default
   `--layout=dashboard`) as a **Server Component by default** — **NO co-located
   `.css` file**. Style exclusively via:
   - shadcn `components/ui/` primitives (`Card`, `Button`, `Table`, `Tabs`,
     `Input`, `Dialog`, …) and app components (`<DataTable>` from
     `components/data-table-generic.tsx`, `<ConfirmDialog>`)
   - Tailwind utility classes bound to `app/globals.css` tokens
     (`bg-background`, `text-muted-foreground`, `border-border`, `bg-primary`)
   - `cn()` from `@/lib/utils` for conditional class composition
   - `"use client"` only when the page needs state/effects/handlers — pushed
     into a co-located `_component.tsx` so the page shell stays server-rendered
     (mirror `app/(dashboard)/dashboard/items/`)
4. Write a Playwright smoke spec at `next-app/e2e/<slug>.spec.ts` asserting the
   route loads, a heading landmark is visible, and at least one expected
   primitive renders (follow `e2e/dashboard-smoke.spec.ts`)

   > **No route registration.** App Router is filesystem-based — creating
   > `app/<slug>/page.tsx` *is* the route. There is no `routeMap.ts` and no
   > `App.tsx` to edit.
5. Write the design review artifact at
   `docs/context/design-review/<slug>.md`
6. **Register the page so it isn't orphaned** (skip for `--layout=none`, which is
   for standalone/marketing pages not meant to live in dashboard nav):
   - Add a nav entry to the `navMain` array in
     `next-app/components/app-sidebar.tsx` (`{ title: "<label>", url:
     "/dashboard/<slug>", icon: <SomeIcon /> }`), gated by role if the page is
     admin-only (mirror the existing `admin` entry's `canEdit`/role check).
   - Add a friendly Chinese label for the slug segment to the `LABELS` map in
     `next-app/components/app-breadcrumb.tsx` so the breadcrumb doesn't fall back
     to a raw-slug title-case guess.
7. Append one `design_generated` event to `.claude/audit.jsonl`

## After completion

Report to the user:

- Files created (with line counts); files edited (`app-sidebar.tsx` +
  `app-breadcrumb.tsx` for the nav/breadcrumb registration, unless
  `--layout=none` — filesystem routing means no separate route-map edit)
- The route URL the new page is reachable at
- Tokens used, primitives flagged as missing (need
  `npx shadcn@latest add <name>`)
- The Stop-verifier will automatically check the new files for `console.log`
  residue, inline `style=` color overrides, and hand-authored
  `components/ui/` files
- Suggested next step (from `next-app/`): `pnpm typecheck && pnpm lint`, then
  `pnpm test:e2e` (needs the DB seeded + dev server, which `webServer`
  auto-boots locally) to confirm the smoke spec passes

If @designer flags missing tokens or primitives, surface them prominently — the
human needs to decide whether to extend the `@theme` token block in
`app/globals.css` or install the missing shadcn primitive.
