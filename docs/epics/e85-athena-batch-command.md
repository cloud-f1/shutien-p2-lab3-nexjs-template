# E85 — `/athena:batch` Parallel Epic Command

> **Phase 25** | Priority: P0 | Points: 13 | Size: L
> **Depends on**: E84 (dependency graph parser)

---

## Problem Statement

The current pipeline (`athena:loop`) processes one epic at a time. With 60+ epic batches anticipated, serial execution (10-30 hours) is the primary bottleneck. A parallel batch command using worktree-isolated agents would deliver ~4x throughput.

## Stories

### S1: Command Definition

**AC:**
- [ ] Create `.claude/commands/athena/batch.md`
- [ ] Accept arguments:
  - `E82,E83,E84,E85` — explicit epic list
  - `--phase 25` — all epics in a phase
  - `--max-concurrent 4` — concurrent agent limit (default: 4)
  - `--dry-run` — show execution plan without running
  - `--tier A|B|C` — filter by tier classification
  - `--step spec|implement|qa|commit` — run only one step per epic
- [ ] Validate all specified epics exist in `epic-progress.md`

### S2: Wave Execution Engine

**AC:**
- [ ] Call `scripts/epic-graph.sh` (E84) to compute execution waves
- [ ] For each wave:
  1. Dispatch up to `--max-concurrent` agents using `Agent` tool with `isolation: "worktree"`
  2. Each agent receives: epic spec, implementation instructions, step to execute
  3. Wait for all agents in the wave to complete
  4. Collect results (success/failure/files changed)
  5. If any agent fails: report failure, continue with remaining epics
- [ ] Between waves: merge completed branches to main (with conflict check)
- [ ] Final report: summary of all epics, pass/fail, duration

### S3: Dry-Run Mode

**AC:**
- [ ] `--dry-run` outputs the execution plan without dispatching agents:
  ```
  Phase 25 — 5 epics, 2 waves
  Wave 1 (3 parallel): E82 [Tier A, 5 SP], E83 [Tier A, 5 SP], E84 [Tier B, 8 SP]
  Wave 2 (2 parallel): E85 [Tier C, 13 SP], E86 [Tier B, 7 SP]
  Estimated: ~25 min (vs ~100 min serial)
  ```
- [ ] Validate dependency graph has no cycles
- [ ] Flag any epic missing a spec file

### S4: Progress Tracking

**AC:**
- [ ] Update `epic-progress.md` as each agent completes its step
- [ ] Log batch execution to `docs/context/orchestration-log.md`
- [ ] Fire webhook (E82) on each epic completion
- [ ] Final status update when all waves complete

### S5: Error Handling

**AC:**
- [ ] Agent timeout: 30 minutes per epic (configurable)
- [ ] On failure: mark epic as ❌ in progress, log error, continue wave
- [ ] On merge conflict: stop wave, report conflicting files, suggest resolution
- [ ] `--retry-failed` flag: re-run only ❌ epics from last batch

## Risk Notes

- Medium risk — worktree coordination is complex
- Test with 2-3 epics before scaling to full batch
- Merge conflicts between waves are the main risk — mitigate by grouping epics that touch different files
- Agent `isolation: "worktree"` handles git isolation automatically

## Files to Touch

```
.claude/commands/athena/batch.md        — new: batch command definition
docs/context/orchestration-log.md       — new: batch execution log
```
