# E265 — Auth Split-Screen + Component Reference

**Phase:** 61 | **Status:** ⬜ | **Depends:** E259, E260

## Problem

Our auth pages (login/signup/forgot) are functional but plain. The Cobalt design uses a premium split-screen (form left, brand testimonial panel right). There's also no component-reference page showcasing the design system.

## Solution

Redesign the `(auth)` layout as a split-screen and add a `/components` reference page. Keep all existing auth logic (NextAuth, RHF+Zod, verify-email, Google SSO) — visual shell only.

## Key Files

- `next-app/app/(auth)/layout.tsx` — split-screen (form + testimonial/brand panel, panel hidden < lg)
- `next-app/app/(auth)/{login,register,...}` — keep forms, restyle to match
- `next-app/app/(dashboard)/components/page.tsx` (new) — reference gallery (buttons/badges/StatusBadge/inputs/tabs/cards/FX)
- (ref: `/tmp/cobalt-design/ai-app/project/cobalt/app/page-auth.jsx`, `page-components.jsx`)

## Implementation

1. Auth split: left form column (logo links home), right brand panel with a testimonial + gradient/aurora; responsive (panel collapses on mobile).
2. Do NOT change form field names / submit handlers (e2e auth selectors must hold).
3. Component reference page (editor+ gated or public-in-dashboard): renders every primitive + the E260 FX, light/dark.

## Acceptance Criteria

- [ ] Auth split-screen renders; **auth e2e green** (login/register/forgot unchanged behaviorally).
- [ ] `/components` (or `/dashboard/components`) reference page renders all primitives + FX.
- [ ] `pnpm build` + lint + typecheck green.

## Out of Scope

- New auth methods. Marketing changes (E266).
