#!/bin/bash
# audit-emit-verification.sh — emit a `verification_check` event to .claude/audit.jsonl
#
# Usage:
#   audit-emit-verification.sh <check-name> <exit-code>
#
# Arguments:
#   check-name   string   Name of the verification command (e.g. "pytest", "pnpm test")
#   exit-code    int      Exit code of the verification command (0 = pass, non-zero = fail)
#
# Environment overrides (for tests):
#   AUDIT_LOG_PATH   Override .claude/audit.jsonl path
#   CLAUDE_AGENT     Agent name (default: unknown)
#   CLOCK_TS         Override timestamp (ISO 8601, for fixture tests)
#
# Examples:
#   scripts/hooks/audit-emit-verification.sh pytest 0
#   scripts/hooks/audit-emit-verification.sh "pnpm test" 0
#   scripts/hooks/audit-emit-verification.sh "coverage-gate" 1
#
# The emitted event:
#   {"ts":"...","event":"verification_check","check":"pytest","exit":0,"agent":"qa","epic":"E188"}
#
# Stop Rule #23 in stop-verifier.sh scans for `verification_check` events with
# exit=0 within the last 10 minutes. A single passing emit clears the gate.

set -euo pipefail

CHECK="${1:-unknown}"
EXIT_CODE="${2:-0}"

# Validate arguments
if [ -z "$CHECK" ]; then
  echo "Usage: audit-emit-verification.sh <check-name> <exit-code>" >&2
  exit 1
fi

# Ensure exit code is numeric
if ! echo "$EXIT_CODE" | grep -qE '^[0-9]+$'; then
  echo "audit-emit-verification.sh: exit-code must be numeric, got: $EXIT_CODE" >&2
  exit 1
fi

# Resolve paths
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" 2>/dev/null || true

AUDIT_LOG="${AUDIT_LOG_PATH:-.claude/audit.jsonl}"
mkdir -p "$(dirname "$AUDIT_LOG")" 2>/dev/null || true

# Agent name from env (set by Claude Code harness for subagent runs)
AGENT="${CLAUDE_AGENT:-unknown}"

# Epic from current branch
BRANCH=$(git branch --show-current 2>/dev/null || echo "")
# First E<digits> token that starts a path/slug segment (feat/E342-athena-sync-wave4 → E342, not E4:
# the previous `.*\(E[0-9]+\).*` was greedy and kept the LAST match in the branch name).
EPIC=$(echo "$BRANCH" | grep -oiE '(^|[/_-])E[0-9]+' | head -1 | sed 's/^[/_-]//' | tr '[:lower:]' '[:upper:]')
[ -z "$EPIC" ] && EPIC="none"

# Timestamp (overridable for tests)
TS="${CLOCK_TS:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"

# Require jq — it's a hard dep for the audit log infrastructure
if ! command -v jq >/dev/null 2>&1; then
  echo "audit-emit-verification.sh: jq not found — cannot emit audit event" >&2
  exit 1
fi

# Emit the JSONL line
jq -n -c \
  --arg ts "$TS" \
  --arg event "verification_check" \
  --arg check "$CHECK" \
  --argjson exit_code "$EXIT_CODE" \
  --arg agent "$AGENT" \
  --arg epic "$EPIC" \
  '{ts:$ts,event:$event,check:$check,exit:$exit_code,agent:$agent,epic:$epic}' \
  >> "$AUDIT_LOG"

echo "verification_check emitted: check=$CHECK exit=$EXIT_CODE agent=$AGENT epic=$EPIC" >&2
