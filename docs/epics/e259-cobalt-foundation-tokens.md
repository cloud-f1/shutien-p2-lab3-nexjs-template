# E259 — Cobalt Foundation Tokens

**Phase:** 60 | **Status:** ⬜ | **Depends:** none

## Problem

The Cobalt design (generated from our own codebase) introduced a richer token set than our `globals.css` carries today — semantic colors, a shadow scale, motion tokens, an 8pt spacing scale, a mono font, and a pill radius. Without them, the premium FX (E260) and landing/dashboard work (E261/E262) have nothing to bind to.

## Solution

Extend `next-app/app/globals.css` with the missing tokens (light + dark), lifted from the Cobalt `tokens.css` (which itself was lifted from us — core colors already match). Additive only; no existing token changes.

## Key Files

- `next-app/app/globals.css` — add tokens to `:root` + `.dark`, wire colors into `@theme inline`

## Implementation

1. Add to `:root` and `.dark`: `--success` / `--warning` / `--info`; `--shadow-xs|sm|md|lg` + `--shadow-focus`; `--dur-fast|base|slow` + `--ease-out|in-out`; `--sp-1..9`; `--font-mono` (Geist Mono); `--radius-pill: 9999px`; `--header-height: 56px`.
2. Wire the new colors into `@theme inline`: `--color-success`, `--color-warning`, `--color-info` (+ foregrounds if added) so `bg-success` / `text-warning` work as Tailwind v4 utilities.
3. Keep our existing WCAG dark-primary fix and all current values untouched.

## Acceptance Criteria

- [ ] All Cobalt tokens present in light + dark, values matching `tokens.css`.
- [ ] `bg-success` / `text-warning` / `text-info` resolve as Tailwind utilities.
- [ ] `pnpm build` + `pnpm typecheck` green; existing tests unaffected (additive).

## Out of Scope

- The FX layer (E260), component usage (E261/E262). Geist Mono font *loading* (declare the var; wire the font in E261 if used).
