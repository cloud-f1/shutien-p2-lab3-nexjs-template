# E89 — `/athena:dashboard` Pipeline Progress Command

> **Phase 26** | Priority: P1 | Points: 8 | Size: M
> **Depends on**: none

---

## Problem Statement

`/athena:batch` runs produce results in `orchestration-log.md` and JSONL audit, but there's no real-time progress view. Operators must read raw logs to understand pipeline state. A dashboard command would render a formatted progress table from existing data.

## Stories

### S1: Command Definition

**AC:**
- [ ] Create `.claude/commands/athena/dashboard.md`
- [ ] Pure read-only command — no side effects, no file modifications
- [ ] Reads from: `.claude/audit.jsonl`, `docs/context/orchestration-log.md`, `docs/context/epic-progress.md`
- [ ] No arguments required (shows current state)
- [ ] Optional: `--phase N` to filter, `--json` for machine-readable output

### S2: Epic Status Table

**AC:**
- [ ] Render per-epic table showing:
  - Epic ID, Name, Step (spec/impl/qa/commit/merge), Status, Duration
- [ ] Show completion percentage per epic (steps done / 5)
- [ ] Color-code: ✅ done, 🔄 in-progress, ⬜ pending, ❌ failed
- [ ] Source: `epic-progress.md` for status, JSONL for durations

### S3: Aggregate Metrics

**AC:**
- [ ] Calculate from JSONL audit log:
  - Average time per epic step
  - Failure rate per agent
  - Total commands executed
  - Coverage trend (if test results available)
- [ ] Handle empty/missing JSONL gracefully (show "no data")
- [ ] Format: summary block below the status table

### S4: Wave Progress (for active batches)

**AC:**
- [ ] If orchestration-log.md has an active batch: show wave progress
  - Current wave number / total waves
  - Agents running / completed / failed per wave
  - ETA based on average step duration
- [ ] If no active batch: show "No active batch. Last batch: {date}"

## Risk Notes

- Low risk — read-only command, no side effects
- JSONL parsing must handle malformed lines gracefully
- Dashboard output should fit in terminal width (~120 chars)

## Files to Touch

```
.claude/commands/athena/dashboard.md  — new: dashboard command
```
