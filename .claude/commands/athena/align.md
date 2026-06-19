---
description: "(quality) UI-surface alignment audit → built app vs SSOT/epics: dead links · orphan pages · missing tabs/sections/deep-links/RBAC → Page-View + Feature-Mapping tables + gaps."
allowed-tools: Read, Bash, Grep, Glob, Agent
---

# /athena:align — Built-App ↔ Spec Surface Alignment

The reverse of `/athena:plan mockup` (spec → epics). This checks that the **built UI surface**
matches what the SSOT (mockup/PRD/domain doc) + the enriched epics declared — so a "missing part"
is caught as a diff at a phase boundary, not in production. Complements `/athena:audit` (which
checks the *data* layer: Drizzle ↔ Zod ↔ Server Action).

Invoke the **`alignment-audit`** skill and follow its pipeline. In short:

## Step 1 — Mechanical pass (deterministic)
```bash
node scripts/align/surface-check.cjs        # dead links · un-localized labels · orphan pages
```
This is also wired into `scripts/smoke.sh` (the `surface-check` gate). Fix or note any failures
before proceeding to the judgment pass.

## Step 2 — Judgment pass (coverage)
Per the `alignment-audit` skill:
1. Derive the EXPECTED surface from the SSOT + each epic's **Surface contract** block
   (route/nav/tabs/sections/deepLinks/rbac in `docs/epics/eNNN-*.md`).
2. Inventory the ACTUAL surface:
   - Routes: `next-app/app/(dashboard)/**`
   - Nav: `next-app/components/app-sidebar.tsx` (navMain items)
   - Breadcrumb: `next-app/components/app-breadcrumb.tsx` (LABELS map)
   - CRUD modals: look for `<Dialog>` usage + `?new=1` / `?edit=<id>` deep-link patterns
   - RBAC: grep `isAdmin`/`canEdit` from `lib/is-admin.ts` usage in route pages + Server Actions
   - DataTable usage: grep `<DataTable>` vs hand-rolled `<table>` in list pages
   Parallelize with `Agent` readers (1–2 pages each) → synthesize.
3. Diff → **Page-View table** + **Feature-Mapping table** + a severity-ranked **gap list**
   (blocker / major / cosmetic, with file:line + the spec source).
4. Confirm with the user which gaps to fix — do NOT auto-fix.

## SOP — when to run
- **After every phase merges to main** (the per-phase contract is fresh; drift is cheapest to fix now).
- **Before a release.**
- Append the result to the phase write-back (`docs/context/orchestration-log.md`) so coverage is recorded.

## Pass criteria
Every SSOT feature + every epic-contract tab/section/deep-link is ✅ shipped or an explicit,
documented exclusion. Anything else is a gap.

## CRUD pattern check (template-specific)
This template's CRUD convention (per CLAUDE.md):
- Create/edit → `<Dialog>` modal, NOT page redirect
- Delete → `components/confirm-dialog.tsx`
- Server Actions return success (no `redirect`) + `revalidatePath` + `router.refresh()`
- Deep-link open: `?new=1` for create, `?edit=<id>` for edit
- Lists use `<DataTable>` from `components/data-table-generic.tsx`

Flag any CRUD page that deviates from this pattern as a gap.
