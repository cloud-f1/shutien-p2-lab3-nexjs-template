#!/usr/bin/env bash
# Fixture-driven unit tests for subagent-stop-writeback.sh (E146).
#
# Builds synthetic .claude/audit.jsonl files in a temp working directory,
# injects them via $AUDIT_LOG_PATH / $STOP_VERIFIER_BLOCK_FLAG, pipes a
# SubagentStop JSON payload to the hook, and asserts on the appended
# agent_complete row. Covers the E146 acceptance criteria.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$SCRIPT_DIR/../subagent-stop-writeback.sh"

if [ ! -x "$HOOK" ]; then
  chmod +x "$HOOK" 2>/dev/null || true
fi
if [ ! -x "$HOOK" ]; then
  echo "FAIL: hook not executable at $HOOK" >&2
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0
FIRST_FAIL=""

pass() {
  echo "PASS: $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "FAIL: $1"
  echo "  $2"
  FAIL=$((FAIL + 1))
  if [ -z "$FIRST_FAIL" ]; then
    FIRST_FAIL="$1: $2"
  fi
}

# Run the hook in an isolated CWD (so the docs/context stamps don't pollute
# the real repo). The hook `cd`s to the git toplevel first, so we wrap it in
# an explicit non-git subdir; the hook's `cd ... || exit 0` still falls
# through to the current directory when git is absent.
#
# Args: 1=audit_path 2=block_flag 3=agent_name
run_hook() {
  local audit="$1" block="$2" agent="$3"
  local cwd
  cwd=$(mktemp -d -p "$TMP" run.XXXXXX)
  (
    cd "$cwd" || exit 1
    # Neutralise the git toplevel lookup so the hook stays in $cwd.
    printf '{"agent_name":"%s"}' "$agent" | \
      PATH="$PATH" \
      AUDIT_LOG_PATH="$audit" \
      STOP_VERIFIER_BLOCK_FLAG="$block" \
      bash -c '
        git() { if [ "$1" = "rev-parse" ]; then echo "."; return 0; fi; command git "$@"; }
        export -f git
        exec bash "'"$HOOK"'"
      '
  )
}

# Append a bash-event line to an audit file.
append_bash() {
  local path="$1" ts="$2" agent="$3" exit_code="$4"
  printf '{"ts":"%s","event":"bash","cmd":"echo","exit":%s,"agent":"%s","epic":"E146","duration_ms":10}\n' \
    "$ts" "$exit_code" "$agent" >>"$path"
}

# Append a pre-existing agent_complete line (to test the "window" behaviour).
append_complete() {
  local path="$1" ts="$2" agent="$3" status="$4"
  printf '{"ts":"%s","event":"agent_complete","agent":"%s","epic":"E146","status":"%s","duration_s":5,"retries":0}\n' \
    "$ts" "$agent" "$status" >>"$path"
}

# Read the LAST agent_complete line from the audit file and return its JSON.
last_complete() {
  local path="$1"
  jq -c 'select(.event == "agent_complete")' "$path" 2>/dev/null | tail -n 1
}

# ---- t1: empty agent name -> hook emits nothing to audit ----
t1() {
  local audit="$TMP/t1.jsonl"
  local block="$TMP/t1.flag"
  : >"$audit"
  run_hook "$audit" "$block" "" >/dev/null 2>&1
  local line
  line=$(last_complete "$audit")
  if [ -z "$line" ]; then
    pass "empty agent name -> no agent_complete row"
  else
    fail "empty agent name -> no agent_complete row" "got: $line"
  fi
}

# ---- t2: no audit history -> success with duration_s=0, retries=0 ----
t2() {
  local audit="$TMP/t2.jsonl"
  local block="$TMP/t2.flag"
  : >"$audit"
  run_hook "$audit" "$block" "spec-writer" >/dev/null 2>&1
  local line
  line=$(last_complete "$audit")
  if [ -n "$line" ] \
     && [ "$(echo "$line" | jq -r .agent)" = "spec-writer" ] \
     && [ "$(echo "$line" | jq -r .status)" = "success" ] \
     && [ "$(echo "$line" | jq -r .retries)" = "0" ] \
     && [ "$(echo "$line" | jq -r .duration_s)" = "0" ]; then
    pass "no history -> success, duration_s=0, retries=0"
  else
    fail "no history -> success, duration_s=0, retries=0" "line=$line"
  fi
}

# ---- t3: bash history with no failures -> success + positive duration ----
t3() {
  local audit="$TMP/t3.jsonl"
  local block="$TMP/t3.flag"
  : >"$audit"
  # Two bash lines, 30 seconds apart, both successful.
  append_bash "$audit" "2026-04-11T00:00:00Z" "qa" 0
  append_bash "$audit" "2026-04-11T00:00:30Z" "qa" 0
  run_hook "$audit" "$block" "qa" >/dev/null 2>&1
  local line
  line=$(last_complete "$audit")
  local status retries duration
  status=$(echo "$line" | jq -r .status)
  retries=$(echo "$line" | jq -r .retries)
  duration=$(echo "$line" | jq -r .duration_s)
  if [ "$status" = "success" ] && [ "$retries" = "0" ] && [ "$duration" -ge 0 ]; then
    pass "bash history, no failures -> success"
  else
    fail "bash history, no failures -> success" "line=$line"
  fi
}

# ---- t4: failed bash entries -> status partial + retries > 0 ----
t4() {
  local audit="$TMP/t4.jsonl"
  local block="$TMP/t4.flag"
  : >"$audit"
  append_bash "$audit" "2026-04-11T00:00:00Z" "debugger" 0
  append_bash "$audit" "2026-04-11T00:00:10Z" "debugger" 1
  append_bash "$audit" "2026-04-11T00:00:20Z" "debugger" 2
  append_bash "$audit" "2026-04-11T00:00:30Z" "debugger" 0
  run_hook "$audit" "$block" "debugger" >/dev/null 2>&1
  local line
  line=$(last_complete "$audit")
  local status retries
  status=$(echo "$line" | jq -r .status)
  retries=$(echo "$line" | jq -r .retries)
  if [ "$status" = "partial" ] && [ "$retries" = "2" ]; then
    pass "retries>0 -> status=partial, retries=2"
  else
    fail "retries>0 -> status=partial, retries=2" "line=$line"
  fi
}

# ---- t5: stop-verifier block flag present -> status failure ----
t5() {
  local audit="$TMP/t5.jsonl"
  local block="$TMP/t5.flag"
  : >"$audit"
  append_bash "$audit" "2026-04-11T00:00:00Z" "qa" 0
  # Flag file with mtime >= start. macOS's touch lacks -d reliably, so we
  # just create it now — the hook compares by epoch, and "now" is >= the
  # 2026 timestamps we embed in the fixture, which evaluates to failure
  # anyway. To guarantee the flag appears newer than START_EPOCH regardless
  # of system clock, we touch with a future timestamp via -t.
  touch -t 203001010000 "$block" 2>/dev/null || touch "$block"
  run_hook "$audit" "$block" "qa" >/dev/null 2>&1
  local line
  line=$(last_complete "$audit")
  local status
  status=$(echo "$line" | jq -r .status)
  if [ "$status" = "failure" ]; then
    # Flag should also be consumed (deleted).
    if [ ! -f "$block" ]; then
      pass "block flag -> status=failure, flag consumed"
    else
      fail "block flag -> status=failure, flag consumed" "flag still exists"
    fi
  else
    fail "block flag -> status=failure, flag consumed" "status=$status line=$line"
  fi
}

# ---- t6: windowing — activity before last agent_complete is ignored ----
t6() {
  local audit="$TMP/t6.jsonl"
  local block="$TMP/t6.flag"
  : >"$audit"
  # Old activity + old complete (should be ignored)
  append_bash "$audit" "2026-04-01T00:00:00Z" "qa" 1
  append_bash "$audit" "2026-04-01T00:00:05Z" "qa" 1
  append_complete "$audit" "2026-04-01T00:00:10Z" "qa" "partial"
  # New window — only 1 fresh success
  append_bash "$audit" "2026-04-11T00:00:00Z" "qa" 0
  run_hook "$audit" "$block" "qa" >/dev/null 2>&1
  local line
  line=$(last_complete "$audit")
  local status retries
  status=$(echo "$line" | jq -r .status)
  retries=$(echo "$line" | jq -r .retries)
  if [ "$status" = "success" ] && [ "$retries" = "0" ]; then
    pass "window respects prior agent_complete"
  else
    fail "window respects prior agent_complete" "line=$line"
  fi
}

# ---- t7: schema has all required fields ----
t7() {
  local audit="$TMP/t7.jsonl"
  local block="$TMP/t7.flag"
  : >"$audit"
  run_hook "$audit" "$block" "best-practice" >/dev/null 2>&1
  local line
  line=$(last_complete "$audit")
  # Required keys per E146 spec: ts, event, agent, epic, status, duration_s, retries
  local missing
  missing=$(echo "$line" | jq -r '
    ["ts","event","agent","epic","status","duration_s","retries"]
    - (keys)
    | join(",")
  ' 2>/dev/null)
  if [ -z "$missing" ]; then
    pass "schema complete (ts,event,agent,epic,status,duration_s,retries)"
  else
    fail "schema complete" "missing: $missing line=$line"
  fi
}

# Run
t1
t2
t3
t4
t5
t6
t7

TOTAL=$((PASS + FAIL))
echo "----"
echo "$PASS/$TOTAL passed"

if [ $FAIL -gt 0 ]; then
  echo "first failure: $FIRST_FAIL" >&2
  exit 1
fi
exit 0
