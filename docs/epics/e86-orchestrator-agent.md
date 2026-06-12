# E86 — `@orchestrator` Agent & Orchestration Log

> **Phase 25** | Priority: P1 | Points: 7 | Size: M
> **Depends on**: E84 (dependency graph), E82 (webhook events)

---

## Problem Statement

Without a dedicated orchestrator agent, `/athena:batch` (E85) must inline all coordination logic. A reusable `@orchestrator` agent provides: dependency resolution, wave scheduling, merge conflict detection, failure retry, and execution logging — separating concerns from the command definition.

## Stories

### S1: Agent Definition

**AC:**
- [ ] Create `.claude/agents/orchestrator.md` with frontmatter:
  ```yaml
  model: opus
  description: >
    Parallel epic orchestrator. Coordinates worktree agents, manages
    dependency graphs, handles merge conflicts, and retries failures.
    Invoked by /athena:batch.
  allowed-tools: Agent, Read, Write, Edit, Bash, Grep, Glob, TaskCreate, TaskUpdate
  ```
- [ ] Define responsibilities:
  - Read dependency graph (via E84 script)
  - Assign epics to worktree agents
  - Monitor agent completion
  - Handle merge conflicts (detect, report, suggest)
  - Auto-retry failures (max 2 attempts)
  - Write execution log

### S2: Orchestration Log

**AC:**
- [ ] Create `docs/context/orchestration-log.md` as write-back document
- [ ] Format per batch execution:
  ```markdown
  ## Batch — {date} — Phase {N}
  | Epic | Wave | Agent | Status | Duration | Branch |
  |------|------|-------|--------|----------|--------|
  ```
- [ ] Append mode — never overwrite previous entries
- [ ] Register in `docs/context/CLAUDE.md` ownership table

### S3: Merge Conflict Detection

**AC:**
- [ ] After each wave completes, attempt merge to main
- [ ] If conflict: identify conflicting files, report to user
- [ ] Suggest resolution strategy:
  - Auto-resolve if conflict is in generated files (types, lock files)
  - Manual resolution required for source files
- [ ] Never force-push or discard changes

### S4: Failure Retry Logic

**AC:**
- [ ] On agent failure (exit != 0 or timeout):
  1. Log failure reason to orchestration-log.md
  2. If retries < 2: re-dispatch agent with error context
  3. If retries exhausted: mark epic ❌, continue with independent epics
- [ ] Retry includes the error from the previous attempt as context
- [ ] Never retry epics that failed due to merge conflicts (those need human intervention)

### S5: Wire into `/athena:batch`

**AC:**
- [ ] Update `.claude/commands/athena/batch.md` (E85) to invoke `@orchestrator` agent
- [ ] Orchestrator receives: epic list, wave plan, max concurrency
- [ ] Orchestrator returns: execution summary, pass/fail per epic

## Risk Notes

- Medium risk — new agent needs clear boundaries
- Scope creep risk: orchestrator should NOT write code, only coordinate
- Must not overlap with `@qa` responsibilities (no code review, no testing)
- Agent-scoped hooks: consider adding `Stop` hook for auto-logging

## Files to Touch

```
.claude/agents/orchestrator.md          — new: agent definition
docs/context/orchestration-log.md       — new: write-back document
docs/context/CLAUDE.md                  — register new document ownership
.claude/commands/athena/batch.md        — wire orchestrator (after E85)
```
