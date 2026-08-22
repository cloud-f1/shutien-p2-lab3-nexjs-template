#!/usr/bin/env bash
# Fixture-driven unit tests for context-health-monitor.sh (E145).
#
# Builds synthetic .claude/audit.jsonl files in a temp dir, injects them via
# $AUDIT_LOG_PATH / $HEALTH_STATE_PATH, runs the hook, and asserts on stdout
# plus exit code. Nine cases covering the acceptance criteria.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$SCRIPT_DIR/../context-health-monitor.sh"

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

# Run the hook with an empty stdin; capture stdout + exit code.
# Args: 1=audit_path 2=state_path
# NOTE: SESSION_ANCHOR_PATH must be injected too. Without it the hook falls back
# to the REAL repo's .claude/.session-anchor, so a fixture of N synthetic calls is
# computed as (N - real_anchor) -> negative -> 0, and every calls-based threshold
# silently never fires. That leak made 4 of these 9 cases fail on any checkout
# with a live session anchor (bytes-based cases passed, since they don't use it).
run_hook() {
  local audit="$1" state="$2" anchor="${3:-$TMP/no-such-anchor}"
  AUDIT_LOG_PATH="$audit" HEALTH_STATE_PATH="$state" SESSION_ANCHOR_PATH="$anchor" \
    bash "$HOOK" </dev/null 2>/dev/null
}

# Generate an audit.jsonl with N synthetic bash-log lines (no file_path)
gen_calls() {
  local path="$1" n="$2" i
  : >"$path"
  for ((i = 0; i < n; i++)); do
    printf '{"ts":"2026-04-11T00:00:00Z","event":"bash","cmd":"echo %d","exit":0,"agent":"test","epic":"E145","duration_ms":1}\n' "$i" >>"$path"
  done
}

# Generate an audit.jsonl with lines that reference real files (for bytes test)
gen_file_refs() {
  local path="$1" target="$2" n="$3" i
  : >"$path"
  for ((i = 0; i < n; i++)); do
    printf '{"ts":"2026-04-11T00:00:00Z","event":"read","tool_input":{"file_path":"%s"}}\n' "$target" >>"$path"
  done
}

# Create a fixture file of approximately N bytes
make_blob() {
  local path="$1" bytes="$2"
  # `yes` + head gives deterministic bulk output across BSD + GNU
  yes "x" 2>/dev/null | head -c "$bytes" >"$path" || true
}

# ---- Case (a): missing file -> silent exit 0
t1() {
  local state="$TMP/state-a"
  : >"$state" # ensure baseline
  local audit="$TMP/does-not-exist.jsonl"
  local out rc
  out=$(run_hook "$audit" "$state")
  rc=$?
  if [ $rc -eq 0 ] && [ -z "$out" ]; then
    pass "missing file -> silent exit 0"
  else
    fail "missing file -> silent exit 0" "rc=$rc out='$out'"
  fi
}

# ---- Case (b): empty file -> silent exit 0
t2() {
  local audit="$TMP/empty.jsonl"
  local state="$TMP/state-b"
  : >"$audit"
  local out rc
  out=$(run_hook "$audit" "$state")
  rc=$?
  if [ $rc -eq 0 ] && [ -z "$out" ]; then
    pass "empty file -> silent exit 0"
  else
    fail "empty file -> silent exit 0" "rc=$rc out='$out'"
  fi
}

# ---- Case (c): below thresholds -> silent exit 0
t3() {
  local audit="$TMP/below.jsonl"
  local state="$TMP/state-c"
  gen_calls "$audit" 50
  local out rc
  out=$(run_hook "$audit" "$state")
  rc=$?
  if [ $rc -eq 0 ] && [ -z "$out" ]; then
    pass "below thresholds -> silent exit 0"
  else
    fail "below thresholds -> silent exit 0" "rc=$rc out='$out'"
  fi
}

# ---- Case (d): yellow trigger on calls >= 200
t4() {
  local audit="$TMP/yellow-calls.jsonl"
  local state="$TMP/state-d"
  gen_calls "$audit" 200
  local out rc
  out=$(run_hook "$audit" "$state")
  rc=$?
  if [ $rc -eq 0 ] && [[ "$out" == *"⚠️"* ]] && [[ "$out" == *"200 calls"* ]] && [[ "$out" == *"filling up"* ]]; then
    pass "yellow trigger on calls >= 200"
  else
    fail "yellow trigger on calls >= 200" "rc=$rc out='$out'"
  fi
}

# ---- Case (e): yellow trigger on bytes >= 500KB
t5() {
  local audit="$TMP/yellow-bytes.jsonl"
  local state="$TMP/state-e"
  local blob="$TMP/blob-e.bin"
  make_blob "$blob" 510000 # ~498 KB per ref; 2 refs = ~996 KB (still < 1 MB)
  # One 510000-byte reference -> just over 500KB threshold
  gen_file_refs "$audit" "$blob" 1
  local out rc
  out=$(run_hook "$audit" "$state")
  rc=$?
  if [ $rc -eq 0 ] && [[ "$out" == *"⚠️"* ]] && [[ "$out" == *"filling up"* ]]; then
    pass "yellow trigger on bytes >= 500KB"
  else
    fail "yellow trigger on bytes >= 500KB" "rc=$rc out='$out'"
  fi
}

# ---- Case (f): red trigger on calls >= 400
t6() {
  local audit="$TMP/red-calls.jsonl"
  local state="$TMP/state-f"
  gen_calls "$audit" 400
  local out rc
  out=$(run_hook "$audit" "$state")
  rc=$?
  if [ $rc -eq 0 ] && [[ "$out" == *"🔴"* ]] && [[ "$out" == *"critical"* ]] && [[ "$out" == *"400 calls"* ]]; then
    pass "red trigger on calls >= 400"
  else
    fail "red trigger on calls >= 400" "rc=$rc out='$out'"
  fi
}

# ---- Case (g): red trigger on bytes >= 1MB
t7() {
  local audit="$TMP/red-bytes.jsonl"
  local state="$TMP/state-g"
  local blob="$TMP/blob-g.bin"
  make_blob "$blob" 1100000
  gen_file_refs "$audit" "$blob" 1
  local out rc
  out=$(run_hook "$audit" "$state")
  rc=$?
  if [ $rc -eq 0 ] && [[ "$out" == *"🔴"* ]] && [[ "$out" == *"critical"* ]]; then
    pass "red trigger on bytes >= 1MB"
  else
    fail "red trigger on bytes >= 1MB" "rc=$rc out='$out'"
  fi
}

# ---- Case (h): dedup — two yellow runs emit once
t8() {
  local audit="$TMP/dedup-yellow.jsonl"
  local state="$TMP/state-h"
  gen_calls "$audit" 250
  local out1 out2 rc1 rc2
  out1=$(run_hook "$audit" "$state"); rc1=$?
  out2=$(run_hook "$audit" "$state"); rc2=$?
  if [ $rc1 -eq 0 ] && [ $rc2 -eq 0 ] && [[ "$out1" == *"⚠️"* ]] && [ -z "$out2" ]; then
    pass "dedup: yellow twice emits once"
  else
    fail "dedup: yellow twice emits once" "rc1=$rc1 out1='$out1' rc2=$rc2 out2='$out2'"
  fi
}

# ---- Case (i): tier escalation — yellow then red emits on the red run
t9() {
  local audit="$TMP/escalate.jsonl"
  local state="$TMP/state-i"
  gen_calls "$audit" 250
  local out1 out2 rc1 rc2
  out1=$(run_hook "$audit" "$state"); rc1=$?
  gen_calls "$audit" 420
  out2=$(run_hook "$audit" "$state"); rc2=$?
  if [ $rc1 -eq 0 ] && [ $rc2 -eq 0 ] \
     && [[ "$out1" == *"⚠️"* ]] \
     && [[ "$out2" == *"🔴"* ]] && [[ "$out2" == *"critical"* ]]; then
    pass "escalation: yellow -> red emits on red run"
  else
    fail "escalation: yellow -> red emits on red run" "rc1=$rc1 out1='$out1' rc2=$rc2 out2='$out2'"
  fi
}


# ---- Case (j): a STALE anchor (> current line count) must NOT silence the monitor.
# The audit log gets rotated/truncated, or the anchor was written against another
# checkout. Clamping (total - anchor) to 0 there leaves the monitor permanently
# quiet — a fail-open. An impossible anchor must be treated as no anchor.
t10() {
  local audit="$TMP/audit-stale" state="$TMP/state-stale" anchor="$TMP/anchor-stale"
  : >"$state"
  gen_calls "$audit" 250          # 250 calls -> well past the yellow threshold
  echo "99999" >"$anchor"         # anchor claims far more lines than exist
  local out rc
  out=$(run_hook "$audit" "$state" "$anchor")
  rc=$?
  case "$out" in
    *"Session context"*) pass "stale anchor (> total) still reports" ;;
    *) fail "stale anchor (> total) still reports" "rc=$rc out='$out' (monitor went silent — fail-open)" ;;
  esac
}

t1
t2
t3
t4
t5
t6
t7
t8
t9
t10
TOTAL=$((PASS + FAIL))
echo "----"
echo "$PASS/$TOTAL passed"

if [ $FAIL -gt 0 ]; then
  echo "first failure: $FIRST_FAIL" >&2
  exit 1
fi
exit 0
