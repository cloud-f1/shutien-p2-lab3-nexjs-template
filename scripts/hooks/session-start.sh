#!/bin/bash
# stdout on SessionStart → added to Claude's context window automatically
# 1M context era: load full project state (~200-400 lines) instead of truncated Quick Reference
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

echo "=== AI-Coding-Template — Session Context ==="
echo "Branch: $BRANCH | Uncommitted: $UNCOMMITTED files"
echo ""

# Block 1: Full session-summary.md (~60 lines)
if [ -f "docs/context/session-summary.md" ]; then
  echo "--- Session Summary ---"
  cat docs/context/session-summary.md
  echo ""
fi

# Block 2: Active epic phase only (~30 lines instead of full history)
if [ -f "docs/context/epic-progress.md" ]; then
  echo "--- Epic Pipeline State (active only) ---"
  # Show only pending/in-progress phases from Phase Status
  grep -E "^## Phase Status|Pending|In-Progress|in-progress" docs/context/epic-progress.md | head -10
  echo ""
  # Show only non-DONE rows from Epic Step Matrix
  sed -n '/^## Epic Step Matrix/,/^## /p' docs/context/epic-progress.md | grep -vE "DONE|Complete" | head -20
  echo ""
  # Always show Next Action section
  sed -n '/^## Next Action/,$p' docs/context/epic-progress.md | head -15
  echo ""
  echo "(Full epic history: docs/context/epic-progress.md)"
fi

# Block 3: Recent git activity (~10 lines)
echo "--- Recent Git Activity ---"
git log --oneline -10 2>/dev/null || echo "(no commits)"
echo ""

# Block 4: Active branch diff summary (~10 lines)
if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "unknown" ]; then
  echo "--- Branch Diff vs Main ---"
  git diff --stat main...HEAD 2>/dev/null | tail -15
  echo ""
fi

# Block 4B: E197 — once-per-day automatic decay-all.
# Reads ~/.claude/template-memory/.last-decay-ts (epoch seconds).
# If absent or older than 86400 s → run score.sh decay-all + update stamp.
# Best-effort (|| true) — a failing decay NEVER blocks SessionStart.
DECAY_STAMP="${HOME}/.claude/template-memory/.last-decay-ts"
DECAY_SCORE_SH="$(git rev-parse --show-toplevel 2>/dev/null)/scripts/memory/score.sh"
DECAY_DEFAULTS_JSON="$(git rev-parse --show-toplevel 2>/dev/null)/scripts/memory/half-life-defaults.json"
{
  _now_ts=$(date +%s 2>/dev/null || echo 0)
  _do_decay=0
  if [ ! -f "$DECAY_STAMP" ]; then
    _do_decay=1
  else
    _stamp_ts=$(cat "$DECAY_STAMP" 2>/dev/null || echo 0)
    _elapsed=$(( _now_ts - _stamp_ts ))
    [ "$_elapsed" -ge 86400 ] && _do_decay=1
  fi
  if [ "$_do_decay" = "1" ] && [ -x "$DECAY_SCORE_SH" ] && [ -d "${HOME}/.claude/template-memory" ]; then
    ALLOW_TIER0_WRITE=1 \
    HALF_LIFE_DEFAULTS_JSON="$DECAY_DEFAULTS_JSON" \
    "$DECAY_SCORE_SH" decay-all "${HOME}/.claude/template-memory" >/dev/null 2>&1 || true
    echo "$_now_ts" > "$DECAY_STAMP" 2>/dev/null || true
  fi
} || true

# Block 5A: Tier 0 always-on PRIMER (curated digest, byte-identical to pre-E182)
PRIMER="$HOME/.claude/template-memory/NEW_PROJECT_PRIMER.md"
if [ -f "$PRIMER" ]; then
  echo "--- Tier 0 Cross-Project Wisdom ---"
  cat "$PRIMER"
  echo ""

  # E180: emit tier0_loaded event for every Tier 0 file actually injected.
  # PRIMER is always-on (Block A). Block B (E182) emits its own events from
  # inject.sh below — one per selected lesson.
  AUDIT_LOG="${AUDIT_LOG_PATH:-.claude/audit.jsonl}"
  mkdir -p "$(dirname "$AUDIT_LOG")" 2>/dev/null
  TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  EPIC=$(echo "$BRANCH" | sed -n 's/.*\(E[0-9]\{1,\}\).*/\1/p')
  [ -z "$EPIC" ] && EPIC="none"
  if command -v jq >/dev/null 2>&1; then
    jq -n -c \
      --arg ts "$TS" \
      --arg event "tier0_loaded" \
      --arg lesson "NEW_PROJECT_PRIMER.md" \
      --arg agent "session-start" \
      --arg epic "$EPIC" \
      '{ts:$ts,event:$event,lesson:$lesson,agent:$agent,epic:$epic}' \
      >> "$AUDIT_LOG" 2>/dev/null || true
  fi

  # E181: chain a strength reinforcement bump. Best-effort — failure here
  # must NEVER block SessionStart (the hook output is injected as Claude's
  # context). The score.sh internal dedup ensures multiple SessionStart
  # injects in the same session count as one bump.
  SCORE_SH="$(git rev-parse --show-toplevel 2>/dev/null)/scripts/memory/score.sh"
  if [ -x "$SCORE_SH" ]; then
    AUDIT_LOG_PATH="$AUDIT_LOG" \
      "$SCORE_SH" reinforce "$PRIMER" tier0_loaded >/dev/null 2>&1 || true
  fi
fi

# Block 5B: Tier 0 cued recall (E182 — selective category-file inject).
# Augments the always-on PRIMER (Block A) with branch-targeted excerpts
# from the underlying 7 category files. Best-effort: a failing inject
# must NEVER block the SessionStart context. inject.sh emits one
# `tier0_loaded` event per selected lesson and chains the matching
# `strength_reinforced` bump via score.sh.
INJECT_SH="$(git rev-parse --show-toplevel 2>/dev/null)/scripts/memory/inject.sh"
if [ -x "$INJECT_SH" ]; then
  AUDIT_LOG_PATH="${AUDIT_LOG_PATH:-.claude/audit.jsonl}" \
    "$INJECT_SH" 2>/dev/null || true
fi

echo "Tip: /athena:load for full context | /athena:save to checkpoint"
