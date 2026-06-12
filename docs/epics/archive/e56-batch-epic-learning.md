# E56 — Batch Epic Learning (`/athena:learn --batch`)

> **Size**: S (5 SP) | **Priority**: P1 | **Phase**: 18
> **Dependencies**: none

---

## Problem Statement

`/athena:learn` currently focuses on memory accuracy correction (comparing MEMORY.md claims against file system truth). It processes one-at-a-time and does not extract patterns from recently completed epics. The ai-web-template project has a "5-epic batch learning" feature that processes the last N epics' QA findings, implementation patterns, and debug lessons in bulk — extracting reusable insights. This template lacks that capability.

## Stories

### S1: `--batch N` Flag for `/athena:learn`
**As a** developer finishing a strategy cycle
**I want** `/athena:learn --batch 5` to review the last 5 epics in bulk
**So that** patterns, recurring issues, and best practices are captured before they fade from context

**Acceptance Criteria**:
- [ ] `/athena:learn --batch 5` reads the last 5 completed epic specs + their PRs
- [ ] Extracts: recurring QA findings, implementation patterns, debug lessons
- [ ] Updates `docs/context/qa-patterns.md` with new entries
- [ ] Tags generalizable patterns with `[GENERALIZABLE]` for later `/athena:promote`
- [ ] Default `--batch 5` when flag is used without a number

### S2: Epic Reflection Summary
**Acceptance Criteria**:
- [ ] For each processed epic, generates a 2-3 line "lesson learned" summary
- [ ] Groups lessons by category: architecture, testing, DX, documentation, security
- [ ] Appends to `docs/context/qa-patterns.md` under a dated "Batch Learning" section

### S3: Suggest After Cycle Completion
**Acceptance Criteria**:
- [ ] When `/athena:loop` detects a phase is fully merged, include "Run `/athena:learn --batch` to capture lessons" in the completion report
- [ ] The suggestion is informational only (not auto-executed)
- [ ] `/athena:plan` completion message also suggests `--batch` when moving a cycle to Completed Cycles

## Technical Notes

- Modify `.claude/commands/athena/learn.md`: parse args for `--batch N` flag (learn.md receives args via `$ARGUMENTS`)
- When `--batch` is present, skip the normal drift-detection flow (Steps 1–3.7) and run batch learning instead
- Read epic specs from `docs/epics/e{n}-*.md` — determine "last N completed" from `docs/context/epic-progress.md` (scan for ✅ merge rows, take last N)
- Read corresponding PRs via `git log --grep="E{n}" --oneline` for implementation context
- Cross-reference with `docs/context/qa-patterns.md` to avoid duplicate entries
- Keep batch learning output concise — max 5 lines per epic
- Without `--batch`, `/athena:learn` behaves exactly as before (memory accuracy refresh)

## Risk Notes

- Batch processing many epics may consume significant context — cap at 10 epics max
- QA patterns file could grow unbounded — add a 200-line limit with archival
