---
name: alignment-audit
description: >
  Audit the BUILT app against its spec to find missing/misaligned parts before release.
  The reverse of mockup-to-epics (spec→epics): this is built-app→spec coverage. Use after a
  phase merges, before a release, or whenever you ask "did we actually ship everything the
  mockup/PRD/epics specified, and do all the links/tabs/RBAC line up?". Produces a Page-View
  table + Feature-Mapping table + a severity-ranked gap list. Pairs with the deterministic
  linter scripts/align/surface-check.cjs (the mechanical half) and the /athena:align command.
user-invocable: true
---

# Alignment Audit — built app vs spec

A feature that's "missing" in production was usually *findable the day its phase merged* — as a
diff between what the spec declared and what the build shipped. This skill makes that diff a
routine, not a lucky manual review.

## When to run
- After each **phase merges to main** (catch drift immediately, per-phase contract is fresh).
- **Before a release.**
- Whenever the surface feels "mostly there" — that's when the missing 10% hides.

## Inputs (the EXPECTED surface)
1. **Design SSOT** — the mockup/PRD/domain doc (if a mockup bundle was used) + screenshots.
   The IA + every screen/tab/deep-link/RBAC rule lives here.
2. **Enriched epics** — each `docs/epics/eNNN-*.md`, especially its **Surface contract** block
   (route/nav/tabs/sections/deepLinks/rbac). This is the per-screen "definition of done".

## Pipeline
1. **Mechanical pass first** — run `node scripts/align/surface-check.cjs`. It deterministically
   catches dead internal links, un-localized nav/breadcrumb labels, and orphan pages.
   Fix or note those; they need no judgment.
2. **Derive EXPECTED** — from the SSOT + epic contracts, list every page, its tabs/sections,
   its required deep-links, and its RBAC gating.
3. **Inventory ACTUAL** — read the built `next-app/app/(dashboard)/**`, components, nav
   (`components/app-sidebar.tsx` + `components/nav-main.tsx`), breadcrumb
   (`components/app-breadcrumb.tsx`), command palette, and grep deep-links
   (`href`/`router.push`/`<Link>`). Parallelize with subagents for many pages
   (one reader per 1–2 pages → structured inventory), then synthesize.
4. **Diff → two tables + gaps:**
   - **Page-View table** — `page · route · tabs/sections · RBAC/nav · ✅/⚠️/❌`.
   - **Feature-Mapping table** — `feature (from SSOT) · epic · route/files · status`.
     Every domain feature in the SSOT must map to a shipped surface or be an explicit
     out-of-scope exclusion.
   - **Gap list** — each `❌ missing` / `⚠️ partial` with severity (blocker / major /
     cosmetic), the file:line, and the spec source it violates.
5. **Confirm with the user** which gaps to fix; don't auto-fix.

## What to check per screen (the diff dimensions)
- **Route exists** + reachable from nav (or intentionally not).
- **Every tab** the contract lists renders content (not a placeholder).
- **Every section/toggle** present (e.g. list/board toggle, settings tabs).
- **Every deep-link** emitted + its destination honors the query param
  (e.g. `?new=1` actually opens the create modal per the CRUD pattern in this template).
- **RBAC** — each gated control enforces the right role *server-side* (not just hidden in UI);
  route-level guards where the spec says "locked". This template uses `isAdmin`/`canEdit` from
  `lib/is-admin.ts` — check that RBAC is applied at the Server Action level, not just client.
- **Labels/copy** — nav + breadcrumb localized; no leftover un-translated route segments in
  `components/app-breadcrumb.tsx`'s `LABELS` map.
- **No orphans** — every reachable page is in the nav (`components/app-sidebar.tsx` navMain
  items) or explicitly allowlisted.
- **CRUD modals** — create/edit open a `<Dialog>` (not page redirect); delete uses
  `<ConfirmDialog>`; Server Actions return success (no `redirect`).
- **DataTable** — record list pages use `<DataTable>` from `components/data-table-generic.tsx`;
  not a hand-rolled `<table>`.
- **No orphan-tested logic** — run `pnpm check:orphans` (`scripts/check-orphan-exports.mjs`,
  from `next-app/`) as part of the audit pipeline. An exported function that's referenced only
  by its own test file (zero production callers) passes every coverage gate while doing
  nothing at runtime — a strong signal a feature was built but never wired into the UI/action
  layer (spec said "add X", the pure function landed, the call site didn't). Treat any orphan
  hit as a gap: either wire it in, or if it's genuinely dead, remove it.

## Quality bar
Every SSOT feature and every epic-contract tab/section/deep-link is either ✅ shipped or an
explicit documented exclusion. If a feature is neither, it's a gap — file it with severity.

## Output
Post the two tables + the gap list. If run as `/athena:align` at a phase boundary, append the
result to the phase write-back (`docs/context/orchestration-log.md`) so the coverage state is
recorded, then let the user pick fixes.
