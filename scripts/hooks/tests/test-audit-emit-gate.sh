#!/bin/bash
# Fixture-driven regression test for audit-emit-gate.sh (E345).
#
# Case (a): pass status emits correctly, no reason required.
# Case (b): fail status emits correctly, no reason required.
# Case (c): skipped WITH a reason emits correctly, reason field lands.
# Case (d): skipped WITHOUT a reason is refused — exit non-zero, nothing
#           appended to the audit log (the load-bearing rule this epic exists
#           to enforce).
# Case (e): optional --epic/--phase/--wave fields land when given.
# Case (f): an invalid status value is refused — exit non-zero, nothing
#           appended.
# Case (g): missing required positional args (gate/status) usage-errors.
#
# Isolation: AUDIT_LOG_PATH override (already supported by the hook).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$SCRIPT_DIR/../audit-emit-gate.sh"

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

# ---- Case (a): pass status ----
t1() {
  local audit="$TMP/a.jsonl"
  AUDIT_LOG_PATH="$audit" bash "$HOOK" typecheck pass >/dev/null 2>&1
  local rc=$?
  local line
  line=$(tail -1 "$audit" 2>/dev/null)
  if [ "$rc" -eq 0 ] && echo "$line" | jq -e '.event == "gate_result" and .gate == "typecheck" and .status == "pass" and (.ts | length) > 0' >/dev/null 2>&1; then
    pass "pass status emits gate_result"
  else
    fail "pass status emits gate_result" "$line (rc=$rc)"
  fi
}

# ---- Case (b): fail status ----
t2() {
  local audit="$TMP/b.jsonl"
  AUDIT_LOG_PATH="$audit" bash "$HOOK" unit fail >/dev/null 2>&1
  local line
  line=$(tail -1 "$audit" 2>/dev/null)
  if echo "$line" | jq -e '.event == "gate_result" and .gate == "unit" and .status == "fail"' >/dev/null 2>&1; then
    pass "fail status emits gate_result"
  else
    fail "fail status emits gate_result" "$line"
  fi
}

# ---- Case (c): skipped WITH reason ----
t3() {
  local audit="$TMP/c.jsonl"
  AUDIT_LOG_PATH="$audit" bash "$HOOK" e2e skipped --reason "shared postgres container owned by another project" --epic E336 --phase 82 >/dev/null 2>&1
  local rc=$?
  local line
  line=$(tail -1 "$audit" 2>/dev/null)
  if [ "$rc" -eq 0 ] && echo "$line" | jq -e '.event == "gate_result" and .gate == "e2e" and .status == "skipped" and .reason == "shared postgres container owned by another project" and .epic == "E336" and .phase == "82"' >/dev/null 2>&1; then
    pass "skipped WITH reason emits full record"
  else
    fail "skipped WITH reason emits full record" "$line (rc=$rc)"
  fi
}

# ---- Case (d): skipped WITHOUT reason -> refused, nothing emitted ----
t4() {
  local audit="$TMP/d.jsonl"
  set +e
  AUDIT_LOG_PATH="$audit" bash "$HOOK" e2e skipped >/dev/null 2>&1
  local rc=$?
  set -e
  if [ "$rc" -ne 0 ] && [ ! -s "$audit" ]; then
    pass "skipped WITHOUT reason is refused (exit != 0, nothing emitted)"
  else
    fail "skipped WITHOUT reason is refused" "rc=$rc, audit-log-size=$(wc -c < "$audit" 2>/dev/null || echo 0)"
  fi
}

# ---- Case (e): optional fields land ----
t5() {
  local audit="$TMP/e.jsonl"
  AUDIT_LOG_PATH="$audit" bash "$HOOK" int pass --epic E344 --phase 83 --wave 1 >/dev/null 2>&1
  local line
  line=$(tail -1 "$audit" 2>/dev/null)
  if echo "$line" | jq -e '.epic == "E344" and .phase == "83" and .wave == "1"' >/dev/null 2>&1; then
    pass "optional --epic/--phase/--wave fields land"
  else
    fail "optional --epic/--phase/--wave fields land" "$line"
  fi
}

# ---- Case (f): invalid status -> refused, nothing emitted ----
t6() {
  local audit="$TMP/f.jsonl"
  set +e
  AUDIT_LOG_PATH="$audit" bash "$HOOK" lint bogus-status >/dev/null 2>&1
  local rc=$?
  set -e
  if [ "$rc" -ne 0 ] && [ ! -s "$audit" ]; then
    pass "invalid status is refused (exit != 0, nothing emitted)"
  else
    fail "invalid status is refused" "rc=$rc, audit-log-size=$(wc -c < "$audit" 2>/dev/null || echo 0)"
  fi
}

# ---- Case (g): missing positional args -> usage error ----
t7() {
  set +e
  bash "$HOOK" >/dev/null 2>&1
  local rc=$?
  set -e
  if [ "$rc" -ne 0 ]; then
    pass "missing positional args -> usage error"
  else
    fail "missing positional args -> usage error" "rc=$rc"
  fi
}

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
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
