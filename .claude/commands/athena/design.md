---
description: "(ui) Generate a React page → design tokens + @designer → TSX + smoke test. Usage: `<slug> "<description>"`."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task
---

Parse the user's input: $ARGUMENTS

The first argument is the page **slug** in kebab-case (e.g. `user-settings`,
`billing-portal`). Everything after the first whitespace-separated token is
the **description** — usually quoted.

Optional flags:

- `--layout=dashboard|auth|none` — which layout to wrap with (default: `dashboard`)
- `--blueprint=<path>` — optional path to an HTML blueprint under `docs/blueprints/`
- `--ref=<path>` — optional path to a reference image (treated as guidance only;
  this command does not require multi-modal input)

Examples:

```
/athena:design user-settings "Tab-based settings page with profile, notifications, billing tabs; reuse DashboardLayout"
/athena:design billing-portal "Stripe-style invoice list with status pills" --layout=dashboard
/athena:design hero-cta "Marketing hero with CTA button" --layout=none --blueprint=docs/blueprints/hero.html
```

If `$ARGUMENTS` is empty OR the slug is missing, respond with the usage
example above and STOP — do not invoke @designer with empty input.

If the slug is not kebab-case (contains uppercase, underscores, or spaces),
normalize it to kebab-case before passing to @designer and warn the user
about the rename.

## Invoke @designer

Pass the parsed inputs as a JSON object via the Task tool, asking @designer
to produce the deliverables defined in `.claude/agents/designer.md`:

```
Inputs:
  slug: "<parsed-slug>"
  description: "<parsed-description>"
  layout: "<dashboard|auth|none, default dashboard>"
  blueprint_path: "<optional path or null>"
```

@designer will:

1. Read the canonical design tokens (`docs/design/design-system.css` +
   `client/src/styles/themes.css`) — do NOT read or reference `client/src/styles/common/`
2. Ask one batched clarifying question if critical info is missing, then
   proceed
3. Write `Page.tsx` and `Page.test.tsx` under `client/src/pages/<slug>/`
   — **NO `Page.css` or `<slug>.css` file** (Stop-verifier Rule #21 blocks
   new page-co-located CSS). Style exclusively via:
   - Tailwind utility classes inline on JSX elements
   - Composing `components/ui/` primitives (`Card`, `Stack`, `PageHeader`, etc.)
   - Preset slots in `components/ui/preset.ts` (defaultPreset / compactPreset /
     editorialPreset / densePreset) for variant-driven visual control
   - Theme CSS vars from `themes.css` via Tailwind `[var(--token)]` syntax when needed
4. Register the route in `client/src/config/routeMap.ts` + `client/src/App.tsx`
5. Write the design review artifact at
   `docs/context/design-review/<slug>.md`
6. Append one `design_generated` event to `.claude/audit.jsonl`

## After completion

Report to the user:

- Files created (with line counts) and files edited
- Tokens used, tokens flagged as missing
- The Stop-verifier will automatically run rules #13 (orphan route),
  #14 (CSS co-location), and #17 (CSS variable drift) against the new files
- Suggested next step: `pnpm --filter client test -- --run src/pages/<slug>/`
  to confirm the smoke test passes

If @designer flags missing tokens, surface them prominently — the human
needs to decide whether to extend `docs/design/design-system.css` or adjust
the design.
