# E163 — Design-to-Code Pipeline (`/athena:design`)

> Phase 40 — Self-Review Improvements | Size: L (8 SP) | Deps: none
> Source: industry signal 2026-04-24 (Claude Design + OpenAI design generation; Figma stock -7.5%)

## Problem

The template has all the design inputs:

- `docs/design/design-system.css` — 47 tokens, canonical source
- `docs/design/dashboard.html` — 7-view static prototype
- `docs/blueprints/` — 4 wireframes
- `docs/guides/` — written design briefs

…but the path from design → working React component is **100% manual**. `@spec-writer` produces API specs but nothing equivalent exists for UI. When the user wants a new page, they hand-port HTML to JSX and re-implement state, routing, forms.

The industry now demonstrates this gap is closable: Claude Design and similar tooling can take screenshot + description → interactive UI. Template-shape projects are the ideal consumer because the design system is already tokenized.

## Solution

Introduce `/athena:design <page-name>` — a new athena command that:

1. Accepts inputs: `{ description, reference-image?, blueprint-html?, existing-component? }`
2. Reads the canonical design system (`design-system.css` tokens + `common/` primitives)
3. Produces:
   - `client/src/pages/<slug>/Page.tsx` — component using DashboardLayout + theme tokens (no Tailwind, no hardcoded colors)
   - `client/src/pages/<slug>/Page.css` — co-located CSS using only CSS variables from design system
   - `client/src/pages/<slug>/Page.test.tsx` — smoke tests (renders, a11y, tokens present)
   - Adds route to `src/App.tsx` + entry to `ROUTE_MAP`
4. Runs Stop-verifier Rule #13 (orphan route) + Rule #14 (CSS co-location) + Rule #17 (CSS var drift) automatically
5. Outputs design review artifact at `docs/context/design-review/<slug>.md` with a11y checklist + responsive breakpoints

New agent: `@designer` — reads tokens, asks for missing info in one batch, produces code that passes existing quality gates.

## Key Files

| File | Action |
|------|--------|
| `.claude/commands/athena/design.md` | New — command spec |
| `.claude/agents/designer.md` | New — agent definition; reads design-system.css + blueprints |
| `scripts/design-pipeline.sh` | New — orchestrates inputs → @designer → quality gates |
| `docs/context/design-review/.gitkeep` | New |
| `docs/context/design-review/README.md` | New — a11y + responsive checklist template |
| `docs/guides/en/design-pipeline.md` | New — "how to use /athena:design" |
| `docs/guides/zh-TW/design-pipeline.md` | New |
| `client/src/pages/_template/` | New — copy-paste template that `@designer` uses as skeleton |
| `.claude/agents/agents-index.md` (if exists, else README) | Edit — team grows from 10 → 11 agents |

## Implementation

### Command flow

```
/athena:design UserSettings "Tab-based settings page with profile, notifications, billing; reuse DashboardLayout"

  1. @designer agent spawned
     inputs:
       - description (from command arg)
       - design tokens (read design-system.css)
       - existing primitives (read common/buttons.css, cards.css, forms.css)
       - blueprint (optional: docs/blueprints/*.html matching slug)
       - theme-awareness contract (uses --primary, --surface, etc.)

  2. Agent produces 3 files to pages/user-settings/

  3. Quality gates (auto-run, must pass before user sees output):
     - Rule #13: orphan route check — new page must be added to App.tsx + ROUTE_MAP
     - Rule #14: CSS must be co-located (not in globals.css)
     - Rule #17: no hardcoded hex/rgb — only var(--*)
     - Smoke test runs: expect(screen.getByRole('main')).toBeInTheDocument()

  4. Writes docs/context/design-review/user-settings.md with:
     - Breakpoint behavior (320 / 768 / 1024 / 1440)
     - a11y checklist (focus order, aria-labels, color contrast AA)
     - Token inventory (which --* vars were used, which were missing)
     - Diff summary
```

### @designer agent skeleton

```markdown
---
name: designer
description: Generate React components from descriptions + design tokens. Outputs production-ready TSX + co-located CSS using theme vars only. Delegates to @best-practice if token set is insufficient.
tools: Read, Edit, Write, Glob, Grep, Bash
---

# Role

Produce a **page or component** that:
- Uses `DashboardLayout` or `AuthLayout` when applicable
- References only CSS variables from `design-system.css`
- Has a co-located `.css` file (never modifies `globals.css`)
- Includes a smoke test + a11y assertion
- Updates ROUTE_MAP if the output is a page

# Contract

Input: `{ slug, description, layout?, blueprint_path? }`
Output: three files under `client/src/pages/<slug>/` + updated App.tsx route

# Missing info

If the description lacks critical info (e.g., "tabs" without tab names), ask ONE batched clarifying question with all gaps listed, then proceed.
```

## Alignment / Cross-Epic Hooks

- **Adds 11th agent**: `@designer` — team grows from 10 → 11 (E147 already added `@evaluator`). Requires updates to:
  - `CLAUDE.md` "Agent Team (10 agents)" → 11
  - `docs/context/session-summary.md` agent roster on next save
  - `MEMORY.md` if agent count is referenced
- **Adds slash command**: `/athena:design` — athena namespace grows from 20 → 21 (current runnable count = 20 per `ls .claude/commands/athena/`). Update `CLAUDE.md` + `MEMORY.md` references.
- **Runs (does not add)** Stop-verifier rules: #13 (orphan route), #14 (CSS co-location), #17 (CSS var drift). Does NOT bump rule count.
- **Reads from**: `docs/design/design-system.css` (token inventory), `client/src/styles/common/*.css` (primitives), `docs/blueprints/*.html` (optional)
- **Writes to**: `client/src/pages/<slug>/`, `docs/context/design-review/<slug>.md`, `.claude/audit.jsonl` event `design_generated`
- **Consumed by**: E164 (future — designer confidence could gate autopilot-driven UI epics)

## Acceptance Criteria

- [ ] `/athena:design <slug> "<description>"` produces 3 files + route registration + design review artifact
- [ ] Generated code passes Stop-verifier Rules #13 (orphan route), #14 (CSS co-location), #17 (CSS var drift) without manual edits
- [ ] Generated smoke test passes
- [ ] Design review artifact includes a11y checklist + token inventory
- [ ] Missing tokens are flagged (not silently hardcoded) with suggested additions to `design-system.css`
- [ ] `@designer` produces output using the current active theme's tokens (dark / indigo / navy / sage compatible)
- [ ] First dogfooding epic: use `/athena:design` to rebuild one existing page and diff against the manually-written version

## Out of Scope

- Figma API import (future: could read `.fig` file directly)
- Image-based input (needs multi-modal, optional Part B)
- Regenerating existing pages (only new page creation in this epic)
