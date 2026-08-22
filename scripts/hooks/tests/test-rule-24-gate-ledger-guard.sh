#!/bin/bash
# Test fixture for Rule 24 — Phase-Completion Gate-Ledger Guard (E345)
#
# Runs stop-verifier.sh in isolated temp git repos with fixture epic-progress
# files + fixture audit logs, exercising the "is this phase newly-complete"
# diff logic and the gate-ledger.sh reconciliation check it delegates to.
#
# Injection: EPIC_PROGRESS_PATH (read via cwd, real files — same pattern as
# Rule 18's own test) + GATE_LEDGER_SH (points at the real scripts/gate-ledger.sh)
# + AUDIT_LOG_PATH (a fixture log per case).

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
STOP_VERIFIER="$REPO_ROOT/scripts/hooks/stop-verifier.sh"
GATE_LEDGER_SH="$REPO_ROOT/scripts/gate-ledger.sh"
EMIT_GATE="$REPO_ROOT/scripts/hooks/audit-emit-gate.sh"

PASS=0
FAIL=0

pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $1 — $2"; FAIL=$((FAIL + 1)); }

# Sets up a temp git repo with an initial Phase Status table (given status),
# commits it, then (optionally) rewrites the row to a new status and leaves
# it dirty (uncommitted) OR commits it too, per $commit_transition.
setup_repo() {
  local tmpdir="$1" initial_status="$2" new_status="$3" commit_transition="$4"
  (
    cd "$tmpdir"
    git init -q
    git config user.email test@test.example
    git config user.name Test
    mkdir -p docs/context
    cat > docs/context/epic-progress.md <<EOF
## Phase Status

| Phase | Epics | Status |
|-------|-------|--------|
| Phase 990 | E9900, E9901 | ${initial_status} |
EOF
    git add .
    git commit -q -m init

    if [ -n "$new_status" ]; then
      cat > docs/context/epic-progress.md <<EOF
## Phase Status

| Phase | Epics | Status |
|-------|-------|--------|
| Phase 990 | E9900, E9901 | ${new_status} |
EOF
      if [ "$commit_transition" = "1" ]; then
        git add docs/context/epic-progress.md
        git commit -q -m "chore(state): Phase 990 complete"
      fi
    fi
  )
}

run() {
  local name="$1" tmpdir="$2" audit="$3" expected_exit="$4" accept_log="${5:-}"
  local actual_exit
  set +e
  # accept_log: passed through as GATE_ACCEPT_LOG_PATH so stop-verifier's
  # internal `gate-ledger.sh --check-only` call (Rule 24) sees the SAME
  # acceptance ledger a test case may have written to directly (its own
  # default, absent this override, is `$tmpdir/.claude/gate-skip-acceptances.jsonl`
  # — a fresh, isolated per-test path since each $tmpdir is its own throwaway
  # git repo, so omitting this for cases with no acceptance is still safe).
  if [ -n "$accept_log" ]; then
    (cd "$tmpdir" && GATE_LEDGER_SH="$GATE_LEDGER_SH" AUDIT_LOG_PATH="$audit" GATE_ACCEPT_LOG_PATH="$accept_log" bash "$STOP_VERIFIER") > /tmp/rule24-out.$$.txt 2>&1
  else
    (cd "$tmpdir" && GATE_LEDGER_SH="$GATE_LEDGER_SH" AUDIT_LOG_PATH="$audit" bash "$STOP_VERIFIER") > /tmp/rule24-out.$$.txt 2>&1
  fi
  actual_exit=$?
  set -e
  if [ "$actual_exit" = "$expected_exit" ]; then
    pass "$name"
  else
    fail "$name" "expected exit $expected_exit, got $actual_exit"
    sed 's/^/      /' /tmp/rule24-out.$$.txt
  fi
  rm -f /tmp/rule24-out.$$.txt
}

echo "=== Rule 24: Phase-Completion Gate-Ledger Guard ==="

# Case 1: newly-complete (dirty), unreconciled skip in the audit log -> BLOCK (2)
T1=$(mktemp -d)
setup_repo "$T1" "🔄 In Progress" "✅ Complete 2026-08-22" "0"
A1=$(mktemp)
AUDIT_LOG_PATH="$A1" bash "$EMIT_GATE" e2e skipped --reason "shared postgres container owned by another project" --epic E9900 --phase 990 >/dev/null 2>&1
run "newly-complete (dirty) + unreconciled skip -> BLOCK" "$T1" "$A1" "2"
rm -rf "$T1" "$A1"

# Case 2: newly-complete (already committed in the most recent commit),
# unreconciled skip -> BLOCK (2). This is the realistic case: the agent
# already ran `git commit` for "chore(state): Phase N complete" before Stop
# fires, so a HEAD-diff-only check (instead of "last commit" too) would miss it.
T2=$(mktemp -d)
setup_repo "$T2" "🔄 In Progress" "✅ Complete 2026-08-22" "1"
A2=$(mktemp)
AUDIT_LOG_PATH="$A2" bash "$EMIT_GATE" e2e skipped --reason "no seeded DB / dev server in this environment" --epic E9901 --phase 990 >/dev/null 2>&1
run "newly-complete (already committed) + unreconciled skip -> BLOCK" "$T2" "$A2" "2"

# Case 2b: a SUBSEQUENT, unrelated Stop (one more commit, phase already
# complete before this session) must NOT re-fire — only a genuine transition
# fires the rule.
(cd "$T2" && echo "dummy" > touched.txt && git add touched.txt && git commit -q -m "chore: unrelated followup")
run "already-complete phase, unrelated follow-up commit -> no re-fire" "$T2" "$A2" "0"
rm -rf "$T2" "$A2"

# Case 3: newly-complete + accepted skip (gate_skip_accepted after the skip) -> PASS (0)
T3=$(mktemp -d)
setup_repo "$T3" "🔄 In Progress" "✅ Complete 2026-08-22" "0"
A3=$(mktemp)
AUDIT_LOG_PATH="$A3" bash "$EMIT_GATE" e2e skipped --reason "shared postgres container owned by another project" --epic E9900 --phase 990 >/dev/null 2>&1
ACCEPT_LOG_3=$(mktemp)
# No CLOCK_TS override here — real wall-clock time, which by construction runs
# AFTER the skip event just emitted above (real time only moves forward), so
# the acceptance genuinely postdates the skip it's reconciling. Hardcoding a
# fixed CLOCK_TS here would risk it landing BEFORE the skip's own (unfixed,
# real-time) timestamp depending on when the suite happens to run, making the
# phase perpetually "unreconciled" from the guard's own correct point of view.
AUDIT_LOG_PATH="$A3" GATE_ACCEPT_LOG_PATH="$ACCEPT_LOG_3" GATE_LEDGER_PATH="$(mktemp)" bash "$GATE_LEDGER_SH" --phase 990 --accept-skips "e2e: tracked in #999" >/dev/null 2>&1
run "newly-complete + human-accepted skip -> PASS" "$T3" "$A3" "0" "$ACCEPT_LOG_3"
rm -rf "$T3" "$A3"

# Case 4: newly-complete, NO gate_result data at all for the phase (the real
# Phase 82 shape — the emitter did not exist yet) -> PASS (0), not blocked.
T4=$(mktemp -d)
setup_repo "$T4" "🔄 In Progress" "✅ Complete 2026-08-22" "0"
A4=$(mktemp)
run "newly-complete, zero gate_result data -> PASS (nothing to reconcile)" "$T4" "$A4" "0"
rm -rf "$T4" "$A4"

# Case 5: NOT newly complete (already ✅ Complete before this session; no
# transition in this diff) -> PASS (0) even with unreconciled data sitting
# in the log for that phase.
T5=$(mktemp -d)
setup_repo "$T5" "✅ Complete 2026-08-01" "" "0"
(cd "$T5" && echo "dummy" > touched.txt && git add touched.txt && git commit -q -m "chore: unrelated")
A5=$(mktemp)
AUDIT_LOG_PATH="$A5" bash "$EMIT_GATE" e2e skipped --reason "some reason" --epic E9900 --phase 990 >/dev/null 2>&1
run "already-complete (no transition) -> PASS regardless of ledger state" "$T5" "$A5" "0"
rm -rf "$T5" "$A5"

# Case 6: phase status changes but NOT to ✅ Complete (e.g. still in progress) -> PASS
T6=$(mktemp -d)
setup_repo "$T6" "⬜ Not Started" "🔄 In Progress" "0"
A6=$(mktemp)
run "status change that is NOT a completion -> PASS (rule doesn't apply)" "$T6" "$A6" "0"
rm -rf "$T6" "$A6"

echo ""
echo "Passed: $PASS | Failed: $FAIL"
[ "$FAIL" = "0" ] || exit 1
