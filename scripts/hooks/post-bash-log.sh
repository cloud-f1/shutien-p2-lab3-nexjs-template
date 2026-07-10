#!/bin/bash
# Audit log — append every bash command as JSONL to .claude/audit.jsonl
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/audit-common.sh
. "$SCRIPT_DIR/lib/audit-common.sh" 2>/dev/null || true
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_result.exit_code // "unknown"' 2>/dev/null)
[ -z "$CMD" ] && CMD="(parse error)"

# tool_result is often absent on this platform → EXIT_CODE="unknown", which would
# make `jq --argjson` fail and silently drop the event. Sanitize to a -1 sentinel
# so the line still lands ("result missing" is itself signal).
case "$EXIT_CODE" in
  ''|*[!0-9-]*) EXIT_CODE=-1 ;;
esac

# Agent attribution
AGENT="${CLAUDE_AGENT:-unknown}"

# Epic ID from branch name (matches feat/E82-slug or E82; case-insensitive,
# uppercase-normalized — see scripts/hooks/lib/audit-common.sh).
if command -v epic_from_branch >/dev/null 2>&1; then
  EPIC=$(epic_from_branch)
else
  BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  EPIC=$(echo "$BRANCH" | sed -n 's/.*\([Ee][0-9]\{1,\}\).*/\1/p' | tr '[:lower:]' '[:upper:]')
  [ -z "$EPIC" ] && EPIC="none"
fi

# Duration (if available from hook input)
DURATION_MS=$(echo "$INPUT" | jq -r '.tool_result.duration_ms // 0' 2>/dev/null)
case "$DURATION_MS" in
  ''|*[!0-9]*) DURATION_MS=0 ;;
esac

TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# AUDIT_LOG_PATH override — mirrors the other hooks' test-injection pattern
# (context-health-monitor.sh, stop-verifier.sh, audit-emit-*.sh) so fixtures
# can drive this hook in isolation instead of writing to the real repo log.
AUDIT_LOG="${AUDIT_LOG_PATH:-.claude/audit.jsonl}"
mkdir -p "$(dirname "$AUDIT_LOG")"

# Write JSONL line
jq -n -c \
  --arg ts "$TS" \
  --arg event "bash" \
  --arg cmd "$CMD" \
  --argjson exit "${EXIT_CODE:-0}" \
  --arg agent "$AGENT" \
  --arg epic "$EPIC" \
  --argjson duration_ms "${DURATION_MS:-0}" \
  '{ts:$ts,event:$event,cmd:$cmd,exit:$exit,agent:$agent,epic:$epic,duration_ms:$duration_ms}' \
  >> "$AUDIT_LOG"

exit 0
