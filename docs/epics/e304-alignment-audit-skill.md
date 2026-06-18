# E304 — Alignment Audit Skill + /athena:align Command

> Phase 71 · toolchain enrichment · quality gate
> Status: ⬜ pending

## Problem

After each phase merges, there is no systematic check that the **built UI surface** matches what the spec/epics declared. `/athena:audit` checks the data layer (Drizzle ↔ Zod ↔ Server Action). But "did we actually ship every tab, every deep-link, every RBAC gate the epic specified?" is not checked.

Missing features at phase boundaries cost the least to fix (the per-phase contract is fresh, the author is in context). In production they become support issues. The gap: no Page-View table, no Feature-Mapping table, no severity-ranked gap list.

## Solution

1. **`.claude/skills/alignment-audit/SKILL.md`** — complete skill covering:
   - When to run (after each phase merges + before any release)
   - Inputs: SSOT (mockup/PRD/domain doc) + enriched epics (Surface contract blocks)
   - Pipeline: mechanical pass → derive EXPECTED → inventory ACTUAL → diff → two tables + gaps
   - What to check per screen: route · tabs · sections · deep-links · RBAC · labels · orphans
   - Quality bar: every SSOT feature is ✅ shipped or an explicit documented exclusion

2. **`scripts/align/surface-check.cjs`** — deterministic mechanical pass:
   - Dead internal links in nav + breadcrumb
   - Un-localized nav/breadcrumb labels (template strings surviving in zh-TW UI)
   - Orphan pages (reachable routes not in the IA or allowlist)
   - Run: `node scripts/align/surface-check.cjs`; wired into `scripts/smoke.sh`

3. **`/athena:align` command** — `.claude/commands/athena/align.md`:
   - Step 1: run `surface-check.cjs` (mechanical)
   - Step 2: invoke `alignment-audit` skill (judgment pass)
   - Appends result to `docs/context/orchestration-log.md`
   - When to run: after every phase merges + before a release

4. **CLAUDE.md update** — add `/athena:align` to the planning commands table

## Key Files

- `.claude/skills/alignment-audit/SKILL.md` (NEW) — complete alignment-audit skill
- `scripts/align/surface-check.cjs` (NEW) — deterministic surface checker
- `.claude/commands/athena/align.md` (NEW) — /athena:align command
- `.claude/commands/athena/plan.md` — add reference to align in SOP
- `CLAUDE.md` — add `/athena:align` to planning commands table + SOP note

## Implementation

### Phase 1 — Script
- Write `scripts/align/surface-check.cjs`:
  - Read `next-app/app/(dashboard)/**` routes
  - Check `nav-items.tsx` (or equivalent) for dead hrefs
  - Grep for un-translated strings in nav/breadcrumb (template-specific patterns)
  - Report orphan pages not in the nav or a `ALLOW_ORPHAN` list
  - Print a ✓/✗ report; exit non-zero if failures

### Phase 2 — Skill
- Port `alignment-audit/SKILL.md` from pm reference
- Adapt to this template's paths (no pm-specific domain knowledge)
- Ensure the two-table output format (Page-View + Feature-Mapping) is documented

### Phase 3 — Command + CLAUDE.md
- Write `.claude/commands/athena/align.md`
- Add to CLAUDE.md planning commands table: `/athena:align — UI-surface alignment → built app vs SSOT/epics → Page-View + Feature-Mapping tables + gaps (run after each phase merges)`
- Wire `surface-check.cjs` into `scripts/smoke.sh` as a gate

## Acceptance Criteria

- [ ] `.claude/skills/alignment-audit/SKILL.md` exists covering all pipeline steps
- [ ] `scripts/align/surface-check.cjs` runs (`node scripts/align/surface-check.cjs`)
- [ ] `.claude/commands/athena/align.md` exists and is recognized as `/athena:align`
- [ ] CLAUDE.md planning commands table updated
- [ ] `scripts/smoke.sh` calls `surface-check.cjs` (or documents that it should)
- [ ] `pnpm build` passes (no import from scripts)

## Out of Scope

- Automated fixing of alignment gaps (report only; human decides what to fix)
- Visual regression testing (VRT is already in the codebase; this is functional coverage)
- API surface alignment (covered by `/athena:audit` + OpenAPI drift gate)
