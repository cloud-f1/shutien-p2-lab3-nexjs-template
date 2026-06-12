# E114 — Stop Verifier Frontend Quality Rules

> Phase 31 — Integration Integrity Shield | Size: S | Deps: E112, E113
> Learned from: ai-casino-shift E161/E164/E167 (systematic prevention via tooling)

## Problem

The stop verifier has 12 rules but none detect: (a) orphan routes (routes without nav entries or vice versa), (b) CSS import mismatches (component has co-located CSS but doesn't import it), (c) non-factory MSW handlers (hardcoded response objects that can drift from schemas).

## Solution

Add 3 new rules (13-15) that catch these issues at development time, before they reach CI.

## Key Files

| File | Action |
|------|--------|
| `scripts/hooks/stop-verifier.sh` | Add 3 new rules |
| `scripts/hooks/CLAUDE.md` | Document new rules |

## Acceptance Criteria

1. **Rule 13 (Orphan Route Check)**: If `routeMap.ts` changed, verify every ROUTE_MAP key appears in App.tsx route definitions. Blocking (exit 2).
2. **Rule 14 (CSS Co-location Check)**: For changed .tsx in components/ or pages/, warn if co-located .css exists but isn't imported. Warning only.
3. **Rule 15 (MSW Factory Check)**: For changed files in tests/handlers/, warn if inline `HttpResponse.json({` with object literal found. Warning only.
4. All 3 rules documented in hooks/CLAUDE.md table
5. Rules are grep-based, complete in <5s
