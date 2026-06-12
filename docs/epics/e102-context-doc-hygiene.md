# E102 — Context Document Hygiene — test-status.md & Write-Back Refresh

> **Phase 29** | Priority: P0 | Points: 8 | Size: M
> **Depends on**: none

---

## Problem Statement

`docs/context/test-status.md` is severely stale — it lists 28 server tests when there are 261, says client tests don't exist when there are 230, and the Test Quality Metrics section (added by E101) has never been populated with actual data. This is the `@qa` agent's primary write-back document, giving completely wrong information to any agent or human reading it.

Other agent write-back documents (`review-findings.md`, `debug-log.md`, `deploy-log.md`, `spec-log.md`) may have similar staleness from rapid Phase 25–28 iteration.

## Stories

### S1: Refresh test-status.md with Actual Data

**AC:**
- [ ] Server test counts updated: 261 tests across unit/integration/contract/hypothesis categories
- [ ] Client test counts updated: 230 tests across 36 files
- [ ] Test file inventory reflects actual `server/tests/` and `client/src/**/*.test.*` structure
- [ ] "Next Action" section no longer says "Begin client/ test infrastructure"
- [ ] Deploy Gate status updated to reflect current state

### S2: Populate Test Quality Metrics (E101)

**AC:**
- [ ] Run the Test Quality Audit metrics collection defined in E101
- [ ] Populate behavior ratio, mock depth, parametrize rate, contract coverage
- [ ] Record first quality score in the history table
- [ ] Quality metrics reflect actual grep/analysis of current test files

### S3: Audit All Agent Write-Back Docs

**AC:**
- [ ] Review each of the 13 docs in `docs/context/` for staleness
- [ ] Fix any stale facts (counts, statuses, dates) found
- [ ] Add a datestamp to each doc indicating last verified date
- [ ] Report which docs were stale and what was fixed

## Risk Notes

- Pure documentation — no code changes, no risk of breaking anything
- May surface additional staleness that requires follow-up

## Files to Touch

```
docs/context/test-status.md          — update: full refresh with actual data
docs/context/review-findings.md      — audit: check for staleness
docs/context/debug-log.md            — audit: check for staleness
docs/context/deploy-log.md           — audit: check for staleness
docs/context/spec-log.md             — audit: check for staleness
docs/context/decisions.md            — audit: check for staleness
docs/context/orchestration-log.md    — audit: check for staleness
```
