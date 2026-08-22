#!/usr/bin/env bash
# PostToolUse — Context Health Monitor (E145)
#
# Reads .claude/audit.jsonl and computes cumulative session metrics:
#   - tool_calls = line count
#   - bytes_read = sum of file sizes for any `tool_input.file_path` values that
#                  exist on disk
#
# Emits context-window warnings to stdout (becomes `additionalContext`):
#   - Yellow (~70% proxy): tool_calls >= 200 OR bytes_read >= 500000
#   - Red    (~85% proxy): tool_calls >= 400 OR bytes_read >= 1000000
#
# Warnings are NON-BLOCKING (always exit 0). Missing/empty audit log exits
# silently. Deduplication: tracks the last-emitted tier in
# `.claude/.health-state` so the same tier only emits once; escalations
# (yellow -> red) still fire.
#
# Session-scoped proxy (E-batch1): tool_calls is offset by the line count
# recorded in .claude/.session-anchor at SessionStart (session-start.sh), so
# the monitor tracks THIS session's activity rather than the repo's lifetime
# audit-log history. Falls back to the raw total line count when the anchor
# file doesn't exist (e.g. hook run standalone, or before session-start.sh
# has ever run).
#
# Test injection:
#   AUDIT_LOG_PATH=/tmp/fixture.jsonl ./context-health-monitor.sh
#   HEALTH_STATE_PATH=/tmp/state ./context-health-monitor.sh
#   SESSION_ANCHOR_PATH=/tmp/anchor ./context-health-monitor.sh

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

# Drain stdin so the pipe closes cleanly. Current stdin is incidental — we
# compute everything from audit.jsonl, not from the current tool call.
cat >/dev/null 2>&1 || true

AUDIT_LOG="${AUDIT_LOG_PATH:-.claude/audit.jsonl}"
STATE_FILE="${HEALTH_STATE_PATH:-.claude/.health-state}"

# Silent exit if the audit log is missing or empty
[ -f "$AUDIT_LOG" ] || exit 0
[ -s "$AUDIT_LOG" ] || exit 0

# Portable file size: prefer GNU stat (-c %s), fall back to BSD stat (-f %z)
filesize() {
  local path="$1"
  if [ ! -f "$path" ]; then
    echo 0
    return
  fi
  local sz
  sz=$(stat -c %s "$path" 2>/dev/null || stat -f %z "$path" 2>/dev/null || echo 0)
  echo "${sz:-0}"
}

# tool_calls = line count of audit.jsonl, offset by the session anchor
# (current - anchor) when the anchor file exists; falls back to the raw
# total when it doesn't (un-sticks the monitor from lifetime history).
TOTAL_LINES=$(wc -l <"$AUDIT_LOG" | tr -d ' ')
TOTAL_LINES=${TOTAL_LINES:-0}

SESSION_ANCHOR_FILE="${SESSION_ANCHOR_PATH:-.claude/.session-anchor}"
if [ -f "$SESSION_ANCHOR_FILE" ]; then
  ANCHOR=$(cat "$SESSION_ANCHOR_FILE" 2>/dev/null | tr -d '[:space:]')
  case "$ANCHOR" in
    ''|*[!0-9]*) ANCHOR=0 ;;
  esac
  # A stale anchor (> current line count) means the audit log was rotated,
  # truncated, or the anchor was written against a different checkout. Silently
  # clamping to 0 there would leave the monitor PERMANENTLY quiet — a fail-open.
  # Treat an impossible anchor as no anchor at all.
  if [ "$ANCHOR" -gt "$TOTAL_LINES" ]; then
    TOOL_CALLS=$TOTAL_LINES
  else
    TOOL_CALLS=$((TOTAL_LINES - ANCHOR))
  fi
else
  TOOL_CALLS=$TOTAL_LINES
fi

# bytes_read = sum of stat sizes for every tool_input.file_path found in the
# audit log. jq streams distinct file paths; the shell loop stats existing
# ones and totals them.
BYTES_READ=0
if command -v jq >/dev/null 2>&1; then
  while IFS= read -r fp; do
    [ -z "$fp" ] && continue
    sz=$(filesize "$fp")
    BYTES_READ=$((BYTES_READ + sz))
  done < <(jq -r '.tool_input.file_path // empty' "$AUDIT_LOG" 2>/dev/null || true)
fi

# Classify tier
TIER="none"
if [ "$TOOL_CALLS" -ge 400 ] || [ "$BYTES_READ" -ge 1000000 ]; then
  TIER="red"
elif [ "$TOOL_CALLS" -ge 200 ] || [ "$BYTES_READ" -ge 500000 ]; then
  TIER="yellow"
fi

# Dedup: read last-emitted tier. Only emit when the computed tier is HIGHER
# than the last-emitted tier. Ranks: none=0, yellow=1, red=2.
tier_rank() {
  case "$1" in
    red) echo 2 ;;
    yellow) echo 1 ;;
    *) echo 0 ;;
  esac
}

LAST_TIER="none"
if [ -f "$STATE_FILE" ]; then
  LAST_TIER=$(cat "$STATE_FILE" 2>/dev/null || echo "none")
  [ -z "$LAST_TIER" ] && LAST_TIER="none"
fi

CUR_RANK=$(tier_rank "$TIER")
LAST_RANK=$(tier_rank "$LAST_TIER")

# Nothing to do below any threshold
if [ "$TIER" = "none" ]; then
  exit 0
fi

# Already emitted at this tier or higher — stay silent
if [ "$CUR_RANK" -le "$LAST_RANK" ]; then
  exit 0
fi

# KB pretty-print (integer KB, rounded down)
KB=$((BYTES_READ / 1024))

case "$TIER" in
  yellow)
    echo "⚠️ Session context filling up (${TOOL_CALLS} calls, ${KB} KB read). Consider \`/athena:save\` to checkpoint."
    ;;
  red)
    echo "🔴 Session context critical (${TOOL_CALLS} calls, ${KB} KB). Recommend \`/athena:save\` + fresh agent handoff."
    ;;
esac

# Persist new tier. mkdir -p the parent in case .claude/ was removed.
mkdir -p "$(dirname "$STATE_FILE")" 2>/dev/null || true
echo "$TIER" >"$STATE_FILE" 2>/dev/null || true

exit 0
