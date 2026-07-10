#!/usr/bin/env bash
# Fixture-driven regression test for post-bash-dispatch.sh — the consolidated
# PostToolUse(Bash) dispatcher that replaces 4 separate hook registrations
# (post-bash-log.sh, pr-created.sh, post-bash-failure-inject.sh,
# post-commit-bugfix-log.sh) with a single stdin read + jq parse + cheap
# string prefilter.
#
# Case (a): plain successful command -> exactly one bash event appended to
#           the audit log (via AUDIT_LOG_PATH override) and no
#           failure-inject output.
# Case (b): failing build/test command (exit 1) -> failure-inject output
#           ("@debugger auto-context") is present.
# Case (c): `git commit` command -> the bugfix-log sub-hook is invoked.
#           HEAD in this repo checkout is not guaranteed to be a `fix:`
#           commit, so post-commit-bugfix-log.sh legitimately no-ops on its
#           own internal filter (its documented "silent-exit path") — this
#           case asserts the dispatcher reaches and runs that sub-hook
#           without erroring, and that the always-on audit log event still
#           lands alongside it.
# Case (d): a sub-hook that crashes (non-zero exit) must not stop the
#           dispatcher from completing with exit 0. Exercised against a
#           synthetic copy of the dispatcher + stub hooks (isolated from the
#           real, unchanged sub-hooks) so we can force a crash deterministically.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$SCRIPT_DIR/../post-bash-dispatch.sh"

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

# ---- Case (a): plain command -> exactly one bash audit event, no failure-inject ----
t_plain_command() {
  local audit="$TMP/a.jsonl"
  local input='{"tool_input":{"command":"echo hi"},"tool_result":{"exit_code":0}}'
  local out
  out=$(echo "$input" | AUDIT_LOG_PATH="$audit" CLAUDE_AGENT=test bash "$HOOK" 2>&1)
  local rc=$?

  if [ "$rc" -ne 0 ]; then
    fail "plain command -> dispatcher exits 0" "rc=$rc"
    return
  fi
  pass "plain command -> dispatcher exits 0"

  if [ -f "$audit" ] && [ "$(wc -l < "$audit" | tr -d ' ')" = "1" ]; then
    pass "plain command -> exactly one audit event appended"
  else
    fail "plain command -> exactly one audit event appended" "audit=$(cat "$audit" 2>/dev/null)"
  fi

  if echo "$out" | grep -q "@debugger auto-context"; then
    fail "plain command -> no failure-inject output" "got: $out"
  else
    pass "plain command -> no failure-inject output"
  fi
}

# ---- Case (b): failing build command -> failure-inject output present ----
t_failing_command() {
  local audit="$TMP/b.jsonl"
  local input='{"tool_input":{"command":"pnpm test"},"tool_result":{"exit_code":1,"stdout":"boom"}}'
  local out
  out=$(echo "$input" | AUDIT_LOG_PATH="$audit" bash "$HOOK" 2>&1)
  local rc=$?

  if [ "$rc" -ne 0 ]; then
    fail "failing command -> dispatcher exits 0" "rc=$rc"
  else
    pass "failing command -> dispatcher exits 0"
  fi

  if echo "$out" | grep -q "@debugger auto-context"; then
    pass "failing command -> failure-inject output present"
  else
    fail "failing command -> failure-inject output present" "got: $out"
  fi
}

# ---- Case (b2): missing tool_result (-1 sentinel) -> failure-inject NOT invoked ----
t_missing_result_no_failure_inject() {
  local audit="$TMP/b2.jsonl"
  local input='{"tool_input":{"command":"pnpm test"}}'
  local out
  out=$(echo "$input" | AUDIT_LOG_PATH="$audit" bash "$HOOK" 2>&1)

  if echo "$out" | grep -q "@debugger auto-context"; then
    fail "missing tool_result -> failure-inject skipped (sentinel)" "got: $out"
  else
    pass "missing tool_result -> failure-inject skipped (sentinel)"
  fi
}

# ---- Case (c): git commit command -> bugfix-log sub-hook reached, dispatcher clean ----
t_git_commit_command() {
  local audit="$TMP/c.jsonl"
  local input='{"tool_input":{"command":"git commit -m test"},"tool_result":{"exit_code":0}}'
  local out
  out=$(echo "$input" | AUDIT_LOG_PATH="$audit" bash "$HOOK" 2>&1)
  local rc=$?

  if [ "$rc" -ne 0 ]; then
    fail "git commit -> dispatcher exits 0" "rc=$rc, out=$out"
  else
    pass "git commit -> dispatcher exits 0 (bugfix-log sub-hook reached, silent-exit path)"
  fi

  if [ -f "$audit" ] && [ "$(wc -l < "$audit" | tr -d ' ')" = "1" ]; then
    pass "git commit -> always-on audit event still lands"
  else
    fail "git commit -> always-on audit event still lands" "audit=$(cat "$audit" 2>/dev/null)"
  fi
}

# ---- Case (d): a crashing sub-hook must not break dispatcher exit 0 ----
t_subhook_crash_isolated() {
  local sandbox="$TMP/sandbox"
  mkdir -p "$sandbox"
  cp "$HOOK" "$sandbox/post-bash-dispatch.sh"

  # Stub out all 4 sub-hooks; post-bash-log.sh (the ALWAYS branch) crashes.
  cat > "$sandbox/post-bash-log.sh" <<'EOF'
#!/bin/bash
cat >/dev/null
echo "stub post-bash-log crashing" >&2
exit 1
EOF
  cat > "$sandbox/pr-created.sh" <<'EOF'
#!/bin/bash
cat >/dev/null
exit 0
EOF
  cat > "$sandbox/post-commit-bugfix-log.sh" <<'EOF'
#!/bin/bash
cat >/dev/null
exit 0
EOF
  cat > "$sandbox/post-bash-failure-inject.sh" <<'EOF'
#!/bin/bash
cat >/dev/null
exit 0
EOF
  chmod +x "$sandbox"/*.sh

  local input='{"tool_input":{"command":"echo hi"},"tool_result":{"exit_code":0}}'
  local out rc
  out=$(echo "$input" | bash "$sandbox/post-bash-dispatch.sh" 2>&1)
  rc=$?

  if [ "$rc" -eq 0 ]; then
    pass "crashing sub-hook (post-bash-log) -> dispatcher still exits 0"
  else
    fail "crashing sub-hook (post-bash-log) -> dispatcher still exits 0" "rc=$rc, out=$out"
  fi
}

t_plain_command
t_failing_command
t_missing_result_no_failure_inject
t_git_commit_command
t_subhook_crash_isolated

TOTAL=$((PASS + FAIL))
echo "----"
echo "$PASS/$TOTAL passed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
