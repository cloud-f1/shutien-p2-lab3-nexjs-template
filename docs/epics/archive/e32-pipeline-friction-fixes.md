# E32: Pipeline Friction Fixes — Spec

> **Size**: S (single session) | **Dependencies**: none | **Branch**: `feat/E32-pipeline-friction-fixes`

---

## Problem Statement

Four independent friction points in the developer pipeline waste context tokens, cause false-positive blocks, and add unnecessary complexity to the merge flow:

1. **False-positive push guard** — `pre-bash-guard.sh` blocks any branch name containing "main" (e.g. `feat/E32-maintain-xyz`) because the regex `git push.*(origin )?main` is unanchored.
2. **Oversized session injection** — `session-start.sh` dumps ~79 lines into the context window (session summary + active track + full template primer). Only the Quick Reference block (~10 lines) is needed; deeper context is available via `/athena:load`.
3. **Stash dance on merge** — The loop's inline merge step requires stashing dirty files (e.g. `session-summary.md`, `epic-progress.md`) before `gh pr merge`, then popping. Since `session-summary.md` is already gitignored, the real issue is `epic-progress.md` and other tracked context docs that get modified during the loop. Solution: use `--auto-merge` so the merge happens asynchronously on GitHub, avoiding local dirty-tree conflicts entirely.
4. **Bloated EPIC_INDEX.md** — The file is 415 lines. Phases 0–7 (E0–E21) are fully complete and their detail sections are never referenced by the loop. Moving them to an archive file cuts the catalog to ~200 lines, reducing token cost every time the loop reads it.

---

## Fix #1: Anchor push guard regex

**File**: `scripts/hooks/pre-bash-guard.sh`

### Before (line 9)

```bash
echo "$CMD" | grep -qE "git push.*(origin )?main"              && { echo "BLOCKED: Use /athena:deploy for production pushes." >&2; exit 2; }
```

### After

```bash
echo "$CMD" | grep -qE "git push\s+(--[a-z-]+\s+)*origin\s+main(\s|$)" && { echo "BLOCKED: Use /athena:deploy for production pushes." >&2; exit 2; }
```

**Why this pattern**:
- `git push\s+` — must start with `git push` followed by whitespace
- `(--[a-z-]+\s+)*` — skip optional flags like `--force`, `--no-verify`
- `origin\s+main` — require explicit `origin main` (the dangerous case)
- `(\s|$)` — anchor to word boundary or end of string (prevents matching `main-feature`)

**Cases tested mentally**:
| Command | Old | New | Correct? |
|---|---|---|---|
| `git push origin main` | BLOCK | BLOCK | Yes |
| `git push --force origin main` | BLOCK | BLOCK | Yes |
| `git push -u origin feat/E32-maintain-search` | BLOCK | ALLOW | Yes (fixed) |
| `git push origin feat/main-page` | BLOCK | ALLOW | Yes (fixed) |
| `git push -u origin HEAD` | ALLOW | ALLOW | Yes |
| `git push origin main-backup` | BLOCK | ALLOW | Yes (fixed) |

---

## Fix #2: Trim session-start.sh injection

**File**: `scripts/hooks/session-start.sh`

### Before (25 lines of script → ~79 lines of output)

```bash
# Dumps: header (3 lines) + last 40 lines of session-summary + active track (3 lines) + primer (30+ lines)
```

### After

```bash
#!/bin/bash
# stdout on SessionStart → added to Claude's context window automatically
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

echo "=== AI-Coding-Template — Session Context ==="
echo "Branch: $BRANCH | Uncommitted: $UNCOMMITTED files"
echo "Tip: /athena:load for full context | /athena:save to checkpoint"

# Quick Reference only — full state via /athena:load
if [ -f "docs/context/session-summary.md" ]; then
  sed -n '/^## Quick Reference$/,/^---$/p' docs/context/session-summary.md | head -15
fi
```

**What changes**:
- Remove `tail -40 docs/context/session-summary.md` (was dumping 40 lines of session detail)
- Remove `grep -A2 "Active Track"` from CLAUDE.md (redundant — Quick Reference covers it)
- Remove `head -30 "$PRIMER"` (template primer is 30+ lines; available via `/athena:load`)
- Add `sed` extraction of only the Quick Reference block from session-summary.md (typically 8–10 lines)
- Output drops from ~79 lines to ~15 lines

---

## Fix #3: Stash-free merge via `--auto-merge`

**File**: `.claude/commands/athena/loop.md`

### Before (implicit behavior)

The loop's merge step currently runs inline:
```
git push -u origin HEAD
gh pr create ...
gh pr merge --squash --delete-branch
git checkout main && git pull
```

If any tracked file is dirty (e.g. `epic-progress.md` just updated in step 5), the merge step must stash before the checkout/pull dance.

### After

Update the merge step instructions in `loop.md` to use `--auto-merge`:

Add to the **merge** step description in the Protocol section:

```markdown
- **merge**: Inline — push, create PR, enable auto-merge, update docs (no local checkout needed)
  1. `git push -u origin HEAD`
  2. `gh pr create --title "..." --body "..."` (or find existing PR)
  3. `gh pr merge --squash --delete-branch --auto` — queues merge on GitHub; does NOT checkout main locally
  4. Update epic-progress.md + EPIC_INDEX.md with merge ✅
  5. Do NOT `git checkout main` or `git pull` — the next loop invocation starts fresh
```

**Why `--auto-merge`**:
- Avoids the stash/pop dance entirely
- Merge happens server-side on GitHub after checks pass
- The loop never needs to switch branches
- The next loop invocation (if on main) can `git pull` cleanly at start
- If auto-merge is not enabled on the repo, fall back to `gh pr merge --squash --delete-branch` but skip the `checkout main && pull` — just report "merged on remote, run `git pull` to sync"

---

## Fix #4: Archive completed epic phases

**Files**:
- `docs/epics/EPIC_INDEX.md` — remove Phase 0–7 detail sections
- `docs/epics/archive/phases-0-7.md` — new file with archived details

### What moves to archive

The "Epic Details" section from line 109 to line 270 (Phases 0–7, epics E0–E21):
- Phase 0: E0 details
- Phase 1: E1, E2, E3 details
- Phase 2: E4, E5, E6 details
- Phase 3: E7, E8 details
- Phase 4: E9, E10 details
- Phase 5: E12, E13, E14, E15 details
- Infrastructure: E11 details
- Phase 7: E21 details

### What stays in EPIC_INDEX.md

- Phase Status table (lines 9–25) — stays (compact summary, always needed)
- Epic Step Matrix for ALL phases — stays (the loop reads step status from here)
- Epic Details for Phase 8+ only (E22 onward) — active/recent reference
- Dependency Rules — stays (still referenced by loop)
- Phase Parallelism — stays
- Session Log — stays

### Archive file header

```markdown
# Epic Details Archive — Phases 0–7 (E0–E21)

> Archived from EPIC_INDEX.md by E32. All epics in this file are ✅ Complete.
> For current epic details, see `docs/epics/EPIC_INDEX.md`.

---
```

### Result

- EPIC_INDEX.md drops from ~415 lines to ~250 lines (~40% reduction)
- Archived content remains accessible but not loaded by the loop

---

## Acceptance Criteria

1. **Push guard**: `git push -u origin feat/E32-maintain-search` is NOT blocked; `git push origin main` IS blocked
2. **Session injection**: `bash scripts/hooks/session-start.sh` produces <= 20 lines of output
3. **Merge flow**: loop.md merge step instructions reference `--auto` flag and do NOT mention `git stash` or `git checkout main`
4. **Archive**: EPIC_INDEX.md is under 260 lines; `docs/epics/archive/phases-0-7.md` contains all moved detail sections; no information is lost
5. **No functional regression**: All existing hook behaviors (destructive command blocking, rm guard) remain unchanged

## Size Estimate

**S** (single session) confirmed — four independent text/script edits with no code compilation or test suite involved.
