# E91 — Post-Wave Integration Test Gate

> **Phase 26** | Priority: P1 | Points: 13 | Size: L
> **Depends on**: E88 (both modify batch.md — avoids merge conflicts)

---

## Problem Statement

When `/athena:batch` dispatches worktree agents, each agent runs tests in isolation. If Agent A and Agent B both pass individually but conflict at merge time, the merged result is untested. A post-wave integration test gate catches merge-time regressions before the next wave starts.

## Stories

### S1: Integration Test Step in `/athena:batch`

**AC:**
- [ ] Update `.claude/commands/athena/batch.md` to add a post-merge test step
- [ ] After each wave's branches merge to main:
  1. Pull latest main
  2. Run full server test suite (`cd server && uv run pytest --cov`)
  3. Run full client test suite (`cd client && pnpm test:run --coverage`)
  4. Verify coverage >= 80% for both
- [ ] If tests pass: proceed to next wave
- [ ] If tests fail: halt pipeline, report which merge caused regression
- [ ] Configurable: `--skip-integration-test` flag to bypass (for speed)

### S2: Regression Detection

**AC:**
- [ ] Compare test results before vs after merge
- [ ] Identify which epic's merge likely caused the failure:
  - Run `git log --oneline -N` to see recent merges
  - If only one merge since last green: that's the culprit
  - If multiple: report all as suspects
- [ ] Log regression details to `docs/context/orchestration-log.md`
- [ ] Format: "Integration test FAILED after wave N merge. Suspects: E{x}, E{y}"

### S3: Update @orchestrator

**AC:**
- [ ] Update `.claude/agents/orchestrator.md` to include integration test coordination
- [ ] Orchestrator runs integration test as a dedicated step between waves
- [ ] If integration test fails: orchestrator reports and halts (does not retry — regression needs investigation)
- [ ] Add to orchestration-log entry: integration test pass/fail status

### S4: Coverage Trend Tracking

**AC:**
- [ ] After each integration test, append coverage numbers to orchestration-log:
  - Server coverage %
  - Client coverage %
  - Delta from previous wave (improvement or regression)
- [ ] Format: `| Integration | Wave N | ✅ PASS | server: 92.1% (+0.3), client: 81.5% (-0.2) |`

## Risk Notes

- Medium risk — integration tests add ~2-5 min to each wave cycle
- Worth it: catches silent regressions that worktree isolation misses
- `--skip-integration-test` provides escape hatch for speed-critical batches

## Files to Touch

```
.claude/commands/athena/batch.md       — update: add post-merge test step
.claude/agents/orchestrator.md         — update: integration test coordination
docs/context/orchestration-log.md      — format: integration test entries
```
