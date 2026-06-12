#!/bin/bash
# Test fixtures for Rule 23 — Verification Discipline (E188)
#
# Rule 23: blocks completion-verb commits (feat:, fix:, refactor:, perf:, test:, style:)
# when no `verification_check` audit event with exit=0 exists within the last 10 min.
# Whitelisted prefixes bypass the rule entirely: wip:, chore(state):, docs:, chore:,
# chore(memory):, chore(roadmap):, build:, ci:.
#
# Pilot mode: rule is gated behind STOP_RULE_23_ENABLED=1 env var.
# Test injection: RULE_23_COMMIT_MSG, RULE_23_WINDOW_MIN, AUDIT_LOG_PATH.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
STOP_VERIFIER="$REPO_ROOT/scripts/hooks/stop-verifier.sh"

PASS=0
FAIL=0

# Helper: run the verifier with an isolated temp git repo.
# Caller sets up the environment via env vars injected through the shell.
run_case() {
  local name="$1"
  local expected_exit="$2"
  shift 2
  # Remaining args are env var assignments (VAR=value …)

  local tmpdir
  tmpdir=$(mktemp -d)
  (
    cd "$tmpdir"
    git init -q
    git config user.email test@test.example
    git config user.name Test
    # Initial commit so HEAD exists
    git commit -q --allow-empty -m "init"
    # Stay on main (rules 18/19/20 only fire on feat/e* branches)
  )

  local actual_exit
  set +e
  # Forward caller env overrides + always enable Rule 23
  env STOP_RULE_23_ENABLED=1 "$@" \
    bash "$STOP_VERIFIER" \
    > /tmp/rule23-out.$$.txt 2>&1 <<< ""
  # Note: stop-verifier reads nothing from stdin (Stop hook), so empty heredoc is fine.
  # We run it from tmpdir to ensure git commands resolve correctly.
  (cd "$tmpdir" && \
    env STOP_RULE_23_ENABLED=1 "$@" \
    bash "$STOP_VERIFIER") > /tmp/rule23-out.$$.txt 2>&1
  actual_exit=$?
  set -e

  if [ "$actual_exit" = "$expected_exit" ]; then
    echo "  ✅ $name"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name — expected exit $expected_exit, got $actual_exit"
    sed 's/^/      /' /tmp/rule23-out.$$.txt
    FAIL=$((FAIL + 1))
  fi

  rm -f /tmp/rule23-out.$$.txt
  rm -rf "$tmpdir"
}

# Cleaner wrapper that sets up the audit log and repo in one place.
run_rule23_case() {
  local name="$1"
  local commit_msg="$2"
  local audit_content="$3"   # JSON lines to write to the audit log (empty = none)
  local expected_exit="$4"

  local tmpdir
  tmpdir=$(mktemp -d)
  local audit_log="$tmpdir/.claude/audit.jsonl"
  mkdir -p "$tmpdir/.claude"

  (
    cd "$tmpdir"
    git init -q
    git config user.email test@test.example
    git config user.name Test
    git commit -q --allow-empty -m "init"
  )

  # Write audit log content if provided
  if [ -n "$audit_content" ]; then
    echo "$audit_content" > "$audit_log"
  fi

  # Compute a timestamp that's within the 10-min window (now)
  local now_ts
  now_ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  local actual_exit
  set +e
  (
    cd "$tmpdir"
    STOP_RULE_23_ENABLED=1 \
    RULE_23_COMMIT_MSG="$commit_msg" \
    AUDIT_LOG_PATH="$audit_log" \
    RULE_23_WINDOW_MIN=10 \
    bash "$STOP_VERIFIER"
  ) > /tmp/rule23-out.$$.txt 2>&1
  actual_exit=$?
  set -e

  if [ "$actual_exit" = "$expected_exit" ]; then
    echo "  ✅ $name"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name — expected exit $expected_exit, got $actual_exit"
    sed 's/^/      /' /tmp/rule23-out.$$.txt
    FAIL=$((FAIL + 1))
  fi

  rm -f /tmp/rule23-out.$$.txt
  rm -rf "$tmpdir"
}

# Helper: build a recent verification_check audit line (within window)
make_verify_event() {
  local check="${1:-pytest}"
  local exit_code="${2:-0}"
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "{\"ts\":\"$ts\",\"event\":\"verification_check\",\"check\":\"$check\",\"exit\":$exit_code,\"agent\":\"qa\",\"epic\":\"E188\"}"
}

# Helper: build a stale verification_check line (older than 10 min)
make_stale_verify_event() {
  local check="${1:-pytest}"
  local exit_code="${2:-0}"
  # 15 minutes ago
  local ts
  ts=$(python3 -c \
    "import datetime; print((datetime.datetime.utcnow() - datetime.timedelta(minutes=15)).strftime('%Y-%m-%dT%H:%M:%SZ'))" \
    2>/dev/null || echo "2020-01-01T00:00:00Z")
  echo "{\"ts\":\"$ts\",\"event\":\"verification_check\",\"check\":\"$check\",\"exit\":$exit_code,\"agent\":\"qa\",\"epic\":\"E188\"}"
}

echo "=== Rule 23: Verification Discipline (E188) ==="

# --- BLOCKED: completion verb, no audit event ---
echo ""
echo "-- Blocked cases --"
run_rule23_case \
  "block feat: commit with no audit log" \
  "feat(E188): add verification discipline" \
  "" \
  "2"

run_rule23_case \
  "block fix: commit with no audit log" \
  "fix(E188): resolve null pointer" \
  "" \
  "2"

run_rule23_case \
  "block refactor: commit with no audit log" \
  "refactor: clean up imports" \
  "" \
  "2"

run_rule23_case \
  "block perf: commit with no audit log" \
  "perf: speed up queries" \
  "" \
  "2"

run_rule23_case \
  "block test: commit with no audit log" \
  "test: add unit tests for rule 23" \
  "" \
  "2"

run_rule23_case \
  "block style: commit with no audit log" \
  "style: reformat code" \
  "" \
  "2"

run_rule23_case \
  "block feat: commit when only a failed verification_check event exists" \
  "feat: ship new feature" \
  "$(make_verify_event pytest 1)" \
  "2"

run_rule23_case \
  "block feat: commit when verification_check is stale (>10 min)" \
  "feat: ship new feature" \
  "$(make_stale_verify_event pytest 0)" \
  "2"

# --- PASSES: completion verb + valid audit event ---
echo ""
echo "-- Pass with verification event --"
run_rule23_case \
  "pass feat: commit with recent verification_check exit=0" \
  "feat(E188): add verification discipline" \
  "$(make_verify_event pytest 0)" \
  "0"

run_rule23_case \
  "pass fix: commit with recent verification_check exit=0" \
  "fix: resolve null pointer" \
  "$(make_verify_event "pnpm test" 0)" \
  "0"

# --- WHITELISTED: bypasses rule regardless of audit log ---
echo ""
echo "-- Whitelisted prefixes (no verification required) --"
run_rule23_case "pass wip: commit (whitelisted)"              "wip: spike on approach"           "" "0"
run_rule23_case "pass chore(state): commit (whitelisted)"     "chore(state): checkpoint Phase 46" "" "0"
run_rule23_case "pass docs: commit (whitelisted)"             "docs: update README"               "" "0"
run_rule23_case "pass chore: commit (whitelisted)"            "chore: bump deps"                  "" "0"
run_rule23_case "pass chore(memory): commit (whitelisted)"    "chore(memory): promote lessons"    "" "0"
run_rule23_case "pass chore(roadmap): commit (whitelisted)"   "chore(roadmap): update roadmap"    "" "0"
run_rule23_case "pass build: commit (whitelisted)"            "build: update Dockerfile"          "" "0"
run_rule23_case "pass ci: commit (whitelisted)"               "ci: fix GitHub Actions workflow"   "" "0"

# --- PILOT MODE: rule disabled when STOP_RULE_23_ENABLED != 1 ---
echo ""
echo "-- Pilot mode (STOP_RULE_23_ENABLED=0) --"

# When STOP_RULE_23_ENABLED is not set, the rule should NOT fire
# even for a completion-verb commit with no audit log.
run_pilot_case() {
  local name="$1"
  local commit_msg="$2"
  local expected_exit="$3"

  local tmpdir
  tmpdir=$(mktemp -d)
  local audit_log="$tmpdir/.claude/audit.jsonl"
  mkdir -p "$tmpdir/.claude"

  (
    cd "$tmpdir"
    git init -q
    git config user.email test@test.example
    git config user.name Test
    git commit -q --allow-empty -m "init"
  )

  local actual_exit
  set +e
  (
    cd "$tmpdir"
    # STOP_RULE_23_ENABLED NOT set (pilot default = off)
    RULE_23_COMMIT_MSG="$commit_msg" \
    AUDIT_LOG_PATH="$audit_log" \
    bash "$STOP_VERIFIER"
  ) > /tmp/rule23-pilot-out.$$.txt 2>&1
  actual_exit=$?
  set -e

  if [ "$actual_exit" = "$expected_exit" ]; then
    echo "  ✅ $name"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name — expected exit $expected_exit, got $actual_exit"
    sed 's/^/      /' /tmp/rule23-pilot-out.$$.txt
    FAIL=$((FAIL + 1))
  fi

  rm -f /tmp/rule23-pilot-out.$$.txt
  rm -rf "$tmpdir"
}

run_pilot_case \
  "pass feat: commit when STOP_RULE_23_ENABLED is not set (pilot mode OFF)" \
  "feat: should not block in pilot mode" \
  "0"

echo ""
echo "Passed: $PASS | Failed: $FAIL"
[ "$FAIL" = "0" ] || exit 1
