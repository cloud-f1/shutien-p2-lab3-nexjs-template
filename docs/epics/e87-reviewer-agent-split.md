# E87 — `@reviewer` Agent — Split from @qa

> **Phase 26** | Priority: P0 | Points: 8 | Size: M
> **Depends on**: none

---

## Problem Statement

`@qa` is overloaded — it handles both code review (read-only analysis) and test execution (Bash-dependent). These are fundamentally different tasks. Splitting into `@reviewer` (read-only, fast) and `@qa` (test execution) enables parallel review+test, review-before-implement, and cleaner write-back separation.

## Stories

### S1: Create `@reviewer` Agent Definition

**AC:**
- [ ] Create `.claude/agents/reviewer.md` with frontmatter:
  - model: sonnet (pattern matching task, not creative)
  - allowed-tools: Read, Grep, Glob (read-only — no Bash, no Edit, no Write)
- [ ] Responsibilities: security audit, architecture review, pattern consistency, accessibility check
- [ ] Designated document: `docs/context/review-findings.md`
- [ ] Include the full review checklist from current `@qa` (RED/YELLOW/GREEN levels)
- [ ] Safety rules: cannot modify files, cannot run tests, output only to review-findings.md

### S2: Refactor `@qa` to Test-Only

**AC:**
- [ ] Update `.claude/agents/qa.md` to remove code review responsibilities
- [ ] @qa focuses exclusively on: test execution (pytest, vitest), coverage gating (>=80%), test report generation
- [ ] Designated documents: `docs/context/test-status.md` (unchanged)
- [ ] Remove review-related instructions from @qa prompt
- [ ] Keep @qa's existing agent-scoped hooks (post-test-coverage-gate.sh)

### S3: Update `/athena:qa` Command

**AC:**
- [ ] Update `.claude/commands/athena/qa.md` to dispatch to correct agent:
  - Default (no flag): run @reviewer first, then @qa (sequential)
  - `--review-only`: dispatch only to @reviewer
  - `--test-only`: dispatch only to @qa
- [ ] Both agents can run in parallel when dispatched together
- [ ] Command reports combined results (review findings + test results)

### S4: Create review-findings.md

**AC:**
- [ ] Create `docs/context/review-findings.md` as @reviewer's write-back document
- [ ] Register in `docs/context/CLAUDE.md` ownership table
- [ ] Format: timestamped entries with severity (RED/YELLOW/GREEN)

### S5: Update CLAUDE.md

**AC:**
- [ ] Update agent count: 8 → 9 agents
- [ ] Add `@reviewer` to agent team list
- [ ] Update `/athena:qa` description to note `--review-only` / `--test-only` flags

## Risk Notes

- Low risk — additive change, existing @qa continues working during transition
- @reviewer is read-only (no Bash) — cannot break anything
- Backward compatible: `/athena:qa` with no flags behaves same as before (review + test)

## Files to Touch

```
.claude/agents/reviewer.md           — new: reviewer agent
.claude/agents/qa.md                 — refactor: remove review, test-only
.claude/commands/athena/qa.md        — update: dispatch logic
docs/context/review-findings.md      — new: write-back document
docs/context/CLAUDE.md               — register ownership
CLAUDE.md                            — update agent count + list
```
