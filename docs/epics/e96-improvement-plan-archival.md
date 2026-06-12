# E96 — Improvement Plan Archival & Status Update

> **Phase 27** | Priority: P2 | Points: 8 | Size: M
> **Depends on**: none

---

## Problem Statement

`docs/reference/agent-webhook-improvement-plan.md` and `docs/reference/parallel-pipeline-strategy.md` were planning documents for Phase 25-26 work. Both phases are now delivered (E82-E91), but the plans still read as if work is pending. Future strategy cycles may re-propose already-done work. The plans need completion status markers so the @strategist does not generate duplicate proposals.

## Stories

### S1: Update `agent-webhook-improvement-plan.md`

**AC:**
- [ ] Add COMPLETED header/banner at top of document
- [ ] Mark Phase 1 items as DONE with PR references (E82-E83, PRs #115-#116)
- [ ] Mark Phase 2 items as DONE with PR references (E84-E86, PRs #117-#119)
- [ ] Mark Phase 3 items as DONE with PR references (E87-E91, PR #120)
- [ ] Outline Phase 4 remaining items (if any) as DEFERRED with rationale
- [ ] Add completion date and total SP delivered

### S2: Update `parallel-pipeline-strategy.md`

**AC:**
- [ ] Add COMPLETED header/banner at top of document
- [ ] Mark all delivered milestones with phase/PR references
- [ ] Note which strategy items were fully delivered vs. partially delivered
- [ ] Outline any remaining strategy items as DEFERRED with rationale
- [ ] Add completion date

### S3: Cross-Reference from Epic Index

**AC:**
- [ ] Verify EPIC_INDEX references to improvement plan are accurate
- [ ] Ensure strategy-log references to these plans note completion status
- [ ] Add note in Phase 25/26 sections pointing to completed plans

## Risk Notes

- Low risk — updating planning documents with completion status
- Important for preventing duplicate proposals in future strategy cycles
- No code changes, purely documentation accuracy

## Files to Touch

```
docs/reference/agent-webhook-improvement-plan.md  — update: mark phases DONE, add completion status
docs/reference/parallel-pipeline-strategy.md      — update: mark milestones DONE, add completion status
docs/epics/EPIC_INDEX.md                          — update: cross-reference if needed
docs/context/strategy-log.md                      — update: note plan completion if needed
```
