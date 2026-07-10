#!/bin/bash
# Fixture-driven regression test for audit-emit-pipeline.sh.
#
# Case (a): zero key=value pairs — must not crash under macOS default bash 3.2
#           (expanding an empty array under `set -u` is an unbound-variable
#           error unless guarded with `${arr[@]+"${arr[@]}"}`). The event must
#           still be emitted with just {ts, event}.
# Case (b): key=value pairs land as fields in the emitted JSON.
# Case (c): an invalid field name (not a shell-safe identifier) is skipped,
#           not fatal — the rest of the valid pairs still land.
#
# Isolation: AUDIT_LOG_PATH override (already supported by the hook).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$SCRIPT_DIR/../audit-emit-pipeline.sh"

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

# ---- Case (a): zero key=value pairs -> event still emitted ----
t1() {
  local audit="$TMP/a.jsonl"
  AUDIT_LOG_PATH="$audit" bash "$HOOK" commit >/dev/null 2>&1
  local rc=$?
  if [ ! -f "$audit" ]; then
    fail "zero pairs -> event still emitted" "audit log not created (rc=$rc)"
    return
  fi
  local line
  line=$(tail -1 "$audit")
  if echo "$line" | jq -e '.event == "commit" and (.ts | length) > 0' >/dev/null 2>&1; then
    pass "zero key=value pairs -> event still emitted (bash 3.2 empty-array safe)"
  else
    fail "zero key=value pairs -> event still emitted" "$line"
  fi
}

# ---- Case (b): key=value pairs land as fields ----
t2() {
  local audit="$TMP/b.jsonl"
  AUDIT_LOG_PATH="$audit" bash "$HOOK" commit epic=E999 sha=abc1234 >/dev/null 2>&1
  local line
  line=$(tail -1 "$audit")
  if echo "$line" | jq -e '.event == "commit" and .epic == "E999" and .sha == "abc1234"' >/dev/null 2>&1; then
    pass "key=value pairs land as fields"
  else
    fail "key=value pairs land as fields" "$line"
  fi
}

# ---- Case (c): invalid key is skipped, valid pairs still land ----
t3() {
  local audit="$TMP/c.jsonl"
  # "bad-key" contains a hyphen (not a shell-safe identifier) -> skipped.
  # "1bad" starts with a digit -> skipped. "epic=E1" is valid -> lands.
  AUDIT_LOG_PATH="$audit" bash "$HOOK" merge "bad-key=nope" "1bad=nope" epic=E1 >/dev/null 2>&1
  local line
  line=$(tail -1 "$audit")
  if echo "$line" | jq -e '.event == "merge" and .epic == "E1" and (has("bad-key") | not) and (has("1bad") | not)' >/dev/null 2>&1; then
    pass "invalid key skipped, valid pairs still land"
  else
    fail "invalid key skipped, valid pairs still land" "$line"
  fi
}

t1
t2
t3

TOTAL=$((PASS + FAIL))
echo "----"
echo "$PASS/$TOTAL passed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
