#!/bin/bash
# Fixture-driven regression test for post-bash-log.sh.
#
# Case (a): input WITHOUT tool_result -> the "unknown" exit_code sentinel
#           must still land as a line, sanitized to exit:-1 (not silently
#           dropped by a failing `jq --argjson`).
# Case (b): input WITH tool_result.exit_code=0 -> exit:0 lands verbatim.
#
# Isolation: AUDIT_LOG_PATH override (added to post-bash-log.sh alongside
# this fixture) — never touches the real .claude/audit.jsonl.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$SCRIPT_DIR/../post-bash-log.sh"

if [ ! -x "$HOOK" ]; then
  echo "FAIL: hook not executable at $HOOK" >&2
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "FAIL: $1"; echo "  $2"; FAIL=$((FAIL + 1)); }

# ---- Case (a): no tool_result -> exit:-1 sentinel, line still appended ----
t1() {
  local audit="$TMP/a.jsonl"
  local input='{"tool_input":{"command":"echo hi"}}'
  echo "$input" | AUDIT_LOG_PATH="$audit" CLAUDE_AGENT=test bash "$HOOK" >/dev/null 2>&1
  if [ ! -f "$audit" ]; then
    fail "no tool_result -> line appended" "audit log not created"
    return
  fi
  local line
  line=$(tail -1 "$audit")
  if echo "$line" | jq -e '.exit == -1' >/dev/null 2>&1; then
    pass "no tool_result -> exit:-1 sentinel"
  else
    fail "no tool_result -> exit:-1 sentinel" "$line"
  fi
}

# ---- Case (b): tool_result.exit_code=0 -> exit:0 ----
t2() {
  local audit="$TMP/b.jsonl"
  local input='{"tool_input":{"command":"echo hi"},"tool_result":{"exit_code":0}}'
  echo "$input" | AUDIT_LOG_PATH="$audit" CLAUDE_AGENT=test bash "$HOOK" >/dev/null 2>&1
  if [ ! -f "$audit" ]; then
    fail "exit_code 0 -> exit:0" "audit log not created"
    return
  fi
  local line
  line=$(tail -1 "$audit")
  if echo "$line" | jq -e '.exit == 0 and .event == "bash" and .cmd == "echo hi"' >/dev/null 2>&1; then
    pass "exit_code 0 -> exit:0"
  else
    fail "exit_code 0 -> exit:0" "$line"
  fi
}

t1
t2

TOTAL=$((PASS + FAIL))
echo "----"
echo "$PASS/$TOTAL passed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
