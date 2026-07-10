#!/bin/bash
# stdout on SessionStart → added to Claude's context window automatically
# 1M context era: load full project state (~200-400 lines) instead of truncated Quick Reference
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/audit-common.sh
. "$SCRIPT_DIR/lib/audit-common.sh" 2>/dev/null || true
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

# ── Audit-log rotation + session anchor (E-batch1) ──────────────────────────
# context-health-monitor.sh used to compute tool_calls from the LIFETIME line
# count of .claude/audit.jsonl, which sticks the yellow/red tiers permanently
# once any long-lived repo accumulates enough history. Fix: at the start of
# every session, snapshot the current line count into .claude/.session-anchor
# so the monitor can compute (current - anchor) = this session's activity.
# Must run before anything below appends to the audit log (Block 5A's
# tier0_loaded event), so the anchor reflects pre-session state.
#
# Also rotates the audit log itself when it exceeds 5MB — an append-only
# JSONL file in a long-lived repo grows unbounded otherwise. Rotation moves
# it to .claude/audit-<YYYYMM>.jsonl and starts a fresh (empty) log, resetting
# the health-state dedup file to "none" (a fresh log has nothing to be red/
# yellow about) and the anchor to 0.
AUDIT_LOG_FOR_ANCHOR="${AUDIT_LOG_PATH:-.claude/audit.jsonl}"
SESSION_ANCHOR_PATH_="${SESSION_ANCHOR_PATH:-.claude/.session-anchor}"
HEALTH_STATE_PATH_FOR_ROTATE="${HEALTH_STATE_PATH:-.claude/.health-state}"
mkdir -p "$(dirname "$AUDIT_LOG_FOR_ANCHOR")" 2>/dev/null
if [ -f "$AUDIT_LOG_FOR_ANCHOR" ]; then
  _audit_bytes=$(stat -f %z "$AUDIT_LOG_FOR_ANCHOR" 2>/dev/null || stat -c %s "$AUDIT_LOG_FOR_ANCHOR" 2>/dev/null || echo 0)
  case "$_audit_bytes" in ''|*[!0-9]*) _audit_bytes=0 ;; esac
  if [ "$_audit_bytes" -gt 5242880 ]; then
    _rotate_suffix=$(date -u +%Y%m 2>/dev/null || echo "unknown")
    mv "$AUDIT_LOG_FOR_ANCHOR" "$(dirname "$AUDIT_LOG_FOR_ANCHOR")/audit-${_rotate_suffix}.jsonl" 2>/dev/null || true
    : > "$AUDIT_LOG_FOR_ANCHOR" 2>/dev/null || true
    echo "none" > "$HEALTH_STATE_PATH_FOR_ROTATE" 2>/dev/null || true
  fi
fi
_anchor_count=0
if [ -f "$AUDIT_LOG_FOR_ANCHOR" ]; then
  _anchor_count=$(wc -l < "$AUDIT_LOG_FOR_ANCHOR" 2>/dev/null | tr -d ' ')
fi
mkdir -p "$(dirname "$SESSION_ANCHOR_PATH_")" 2>/dev/null
echo "${_anchor_count:-0}" > "$SESSION_ANCHOR_PATH_" 2>/dev/null || true

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
  # Case-insensitive, uppercase-normalized — see scripts/hooks/lib/audit-common.sh.
  if command -v epic_from_branch >/dev/null 2>&1; then
    EPIC=$(epic_from_branch "$BRANCH")
  else
    EPIC=$(echo "$BRANCH" | sed -n 's/.*\([Ee][0-9]\{1,\}\).*/\1/p' | tr '[:lower:]' '[:upper:]')
    [ -z "$EPIC" ] && EPIC="none"
  fi
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
