# E88 — Debugger Auto-Retry & Failure Pattern Matching

> **Phase 26** | Priority: P1 | Points: 13 | Size: L
> **Depends on**: none

---

## Problem Statement

`@debugger` is passive — only invoked manually on error reports. In a parallel pipeline, worktree agents can fail silently. Known failure patterns (9 server, 7 client) are documented in `debug-log.md` but not programmatically matched. Auto-retry with pattern matching would reduce manual intervention.

## Stories

### S1: Failure Detection Hook

**AC:**
- [ ] Create/update `PostToolUse(Bash)` hook that detects non-zero exit codes
- [ ] When exit != 0: inject @debugger context (known patterns, error message)
- [ ] Context includes: the failed command, exit code, last 50 lines of output
- [ ] Non-blocking — injects context as `additionalContext`, doesn't block execution
- [ ] Only triggers for test/build commands (not git, ls, etc.)

### S2: Known-Failure Pattern Matching

**AC:**
- [ ] Parse `docs/context/debug-log.md` for known failure patterns
- [ ] Build a pattern → fix lookup table (9 server + 7 client patterns)
- [ ] When a failure matches a known pattern: include the fix suggestion in context
- [ ] Format: "Known pattern: {name}. Fix: {description}. Reference: {debug-log entry}"
- [ ] Patterns include: python-jose, asyncio loops, stale UI, MSW handler, alembic, token cache, etc.

### S3: Auto-Retry in `/athena:batch`

**AC:**
- [ ] Update `.claude/commands/athena/batch.md` to support auto-retry on agent failure
- [ ] Max 2 retry attempts per epic (configurable via `--max-retries`)
- [ ] Each retry includes: previous error output + known pattern match (if any)
- [ ] Exponential backoff: retry 1 immediate, retry 2 after 30s pause
- [ ] Track retry count in `docs/context/orchestration-log.md`

### S4: Circuit Breaker

**AC:**
- [ ] If same root cause appears twice (same error pattern): escalate to human
- [ ] Stop retrying that epic, mark as ❌ with "circuit breaker: {pattern}"
- [ ] Continue with other independent epics in the wave
- [ ] Report: "Epic E{n} failed twice with same pattern. Human intervention required."

### S5: Update @debugger Agent

**AC:**
- [ ] Update `.claude/agents/debugger.md` with auto-retry awareness
- [ ] Add section on known-pattern matching workflow
- [ ] Document circuit breaker behavior

## Risk Notes

- Medium risk — auto-retry logic must distinguish flaky tests from real failures
- Circuit breaker prevents infinite loops
- Hook must be scoped to avoid triggering on benign commands (git status, ls)

## Files to Touch

```
scripts/hooks/post-bash-failure-inject.sh  — new: failure context injection hook
.claude/agents/debugger.md                 — update: auto-retry awareness
.claude/commands/athena/batch.md           — update: retry logic
.claude/settings.json                      — register new hook
docs/context/orchestration-log.md          — retry tracking format
```
