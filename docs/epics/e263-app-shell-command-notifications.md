# E263 — App Shell: ⌘K Palette + Notifications + Breadcrumb

**Phase:** 61 | **Status:** ⬜ | **Depends:** E259, E260

## Problem

The Cobalt design's authenticated shell has a ⌘K command palette, a notifications dropdown, and a breadcrumb topbar. Our `(dashboard)` shell (sidebar-01) has none of these.

## Solution

Add the three shell affordances to the existing `(dashboard)` layout using shadcn primitives — no domain logic, RBAC-aware where relevant.

## Key Files

- `next-app/components/command-palette.tsx` (new) — shadcn `command` + dialog, ⌘K hotkey, nav + actions (client)
- `next-app/components/notifications-menu.tsx` (new) — dropdown of notifications (mock until E272 wires data)
- `next-app/components/app-breadcrumb.tsx` (new) — segment breadcrumb from the pathname
- `next-app/app/(dashboard)/**` topbar — mount the three
- (ref: `/tmp/cobalt-design/ai-app/project/cobalt/app/shell.jsx`)

## Implementation

1. `npx shadcn add command` if absent; build the palette (routes + theme toggle + sign-out), bound to ⌘K / Ctrl+K.
2. Notifications dropdown (bell + unread dot) with placeholder items; data hook reserved for E272.
3. Breadcrumb derived from `usePathname()`; admin/editor labels via existing i18n.

## Acceptance Criteria

- [ ] ⌘K opens the palette; navigates + toggles theme; reduced-motion safe.
- [ ] Notifications dropdown + breadcrumb render in the topbar; RBAC nav unchanged.
- [ ] `pnpm build` + lint + typecheck green; **e2e still green** (no test-selector regressions).

## Out of Scope

- Real notifications backend (E272). Workflow/product pages (skipped).
