# E151 — Unified Test Plan Template

> Phase 38 — Cross-Project Extraction | Size: S (3 SP) | Deps: none
> Source: ai-casino-shift E218

## Problem

As projects grow, test documentation fragments across multiple files — `test-status.md`, `test-plan.md`, individual epic specs, QA reports. Teams lose the holistic view of what's tested, what's risky, and when testing is "done enough". Casino-shift had 10 scattered test docs before consolidation.

## Solution

Create a `docs/templates/test-plan-template.md` that downstream projects copy and customize. The template includes:

1. **Test pyramid visualization** — unit / integration / E2E / manual layers with targets
2. **Risk matrix** — domain-specific risks ranked by likelihood × impact
3. **RBAC compatibility matrix** — roles × actions verification grid
4. **Coverage targets** — per-layer thresholds with justification
5. **"When to stop testing" framework** — decision criteria for GA readiness

## Key Files

| File | Action |
|------|--------|
| `docs/templates/` | New — templates directory (first use) |
| `docs/templates/test-plan-template.md` | New — reusable test plan (~120 lines) |
| `docs/guides/en/quickstart.md` | Update — link to template in testing section |
| `docs/epics/e151-unified-test-plan-template.md` | New — this spec |

## Acceptance Criteria

1. Template has all 5 sections listed above
2. Risk matrix includes example rows with `[HIGH/MED/LOW]` severity
3. RBAC matrix is a markdown table with roles as columns, actions as rows
4. Coverage targets section explains 80% vs 90% rationale (API boundary vs utility)
5. "When to stop" section has 3+ quantitative criteria (not just "feels done")
6. Template uses placeholder markers (`{{PROJECT_NAME}}`, `{{DOMAIN_LIST}}`) for customization
7. Linked from quickstart guide's testing section
8. Companion to E152 (manual test checklist) — cross-referenced in both templates

## Design Notes

- Extracted from ai-casino-shift's E218 which consolidated 10 docs into 1
- "When to stop testing" borrowed from Chronos project — prevents gold-plating
- RBAC matrix is the highest-value section for multi-role apps
