#!/bin/bash
# Test fixture: acceptances must be COMMITTED and survive a fresh clone (E345),
# AND reconciliation must be durable/existence-based, not a timestamp race.
#
# History (two rounds of QA review found real bugs here — both fixed, both
# regression-tested below; read this before touching the semantics again):
#
# Round 1: the first cut of gate-ledger.sh put `--accept-skips`
# acknowledgements in a gitignored `.claude/gate-skip-acceptances.jsonl`.
# Wrong under this repo's real execution model:
#   - /athena:batch dispatches across .claude/worktrees/agent-*, each an
#     independent filesystem checkout — a gitignored file written in ONE
#     worktree is invisible to a SIBLING worktree.
#   - docs/context/gate-ledger.md is a COMMITTED, fully-regenerated render
#     artifact. Regenerating it from a checkout that lacks the local
#     acceptance file would silently strip a human's recorded decision back
#     out of tracked history.
# Fix: the acceptance ledger now lives at docs/context/gate-skip-acceptances.jsonl
# — COMMITTED, not gitignored.
#
# Round 2: the "unreconciled" check compared `lastAcceptTs < lastSkipTs`
# (both second-resolution timestamps). A loop of this exact test caught it
# flaking ~17% of the time — whenever the skip and accept events landed in
# the same wall-clock second, or (worse) whenever a skip was independently
# re-observed AFTER an acceptance already existed, the comparison flipped
# back to "unreconciled" with no human having done anything wrong. Fix:
# reconciliation is now existence-only and durable — "has ANY acceptance
# ever been recorded for this phase" — with NO timestamp comparison at all.
# See gate-ledger.sh's header comment for the full reasoning (mirrors
# /athena:approve: an approval isn't invalidated by later re-reading the file).
#
# This test pins every timestamp via CLOCK_TS so it asserts the CHOSEN
# semantics deterministically, not whichever side of a clock-second boundary
# a real run happens to land on.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
GATE_LEDGER_SH="$REPO_ROOT/scripts/gate-ledger.sh"
EMIT_GATE="$REPO_ROOT/scripts/hooks/audit-emit-gate.sh"

PASS=0
FAIL=0
pass() { echo "  ✅ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ❌ $1 — $2"; FAIL=$((FAIL + 1)); }

echo "=== Gate ledger: committed-acceptance persistence + durability ==="

# Pinned, deliberately-ordered timestamps (all via CLOCK_TS — no wall clock
# involved anywhere below):
#   T_SKIP_A   = workA's own skip, recorded first
#   T_ACCEPT   = the human acceptance, recorded second (normal order)
#   T_SKIP_B   = workB's independently-emitted "same logical skip" —
#                recorded THIRD, i.e. AFTER the acceptance. This is exactly
#                the scenario Round 2's bug mis-handled: under the old
#                timestamp-comparison semantics, T_ACCEPT < T_SKIP_B would
#                flip the phase back to "unreconciled" even though a human
#                already accepted it. Under the fixed, durable semantics it
#                must stay reconciled.
T_SKIP_A="2026-08-22T09:00:00Z"
T_ACCEPT="2026-08-22T09:00:05Z"
T_SKIP_B="2026-08-22T09:00:10Z"

BARE=$(mktemp -d)/origin.git
WORK_A=$(mktemp -d)
WORK_B=$(mktemp -d)

git init -q --bare "$BARE"

# ---------------------------------------------------------------------------
# workA: the "machine/worktree where the human ran --accept-skips".
# ---------------------------------------------------------------------------
git clone -q "$BARE" "$WORK_A" 2>/dev/null
(
  cd "$WORK_A"
  git config user.email test@test.example
  git config user.name Test
  mkdir -p docs/context
  echo "# placeholder" > docs/context/epic-progress.md
  git add docs/context/epic-progress.md
  git commit -q -m init
)

# The skip itself is local telemetry (.claude/audit.jsonl equivalent) — NOT
# committed. That asymmetry is intentional and out of scope for this fix
# (gate_result's own cross-worktree visibility is a separate, pre-existing
# characteristic of the whole audit.jsonl system); what this test isolates
# is specifically whether the ACCEPTANCE survives a clone and whether
# reconciliation is durable.
AUDIT_A="$WORK_A/.claude/audit.jsonl"
mkdir -p "$WORK_A/.claude"
CLOCK_TS="$T_SKIP_A" AUDIT_LOG_PATH="$AUDIT_A" bash "$EMIT_GATE" e2e skipped --reason "shared postgres container owned by another project" --epic E9950 --phase 995 >/dev/null 2>&1

# Record the acceptance using the REAL default path (no GATE_ACCEPT_LOG_PATH
# override) — this is the exact call a human would run.
(cd "$WORK_A" && CLOCK_TS="$T_ACCEPT" AUDIT_LOG_PATH="$AUDIT_A" bash "$GATE_LEDGER_SH" --phase 995 --accept-skips "e2e: DB isolation fix tracked in #117" >/dev/null 2>&1)

if [ -f "$WORK_A/docs/context/gate-skip-acceptances.jsonl" ]; then
  pass "accept-skips wrote to the default COMMITTED path (docs/context/gate-skip-acceptances.jsonl)"
else
  fail "accept-skips wrote to the default COMMITTED path" "file not found in workA"
fi

if [ -f "$WORK_A/.claude/gate-skip-acceptances.jsonl" ]; then
  fail "acceptance is NOT also written under .claude/ (old, gitignored location)" "found at $WORK_A/.claude/gate-skip-acceptances.jsonl"
else
  pass "acceptance is NOT written under .claude/ (old, gitignored location)"
fi

# Commit and share the acceptance ledger with the "remote", exactly as a
# human's workflow would (a plain feature-branch push, not to main/master —
# the pre-bash-guard here just needs a HEAD ref name, not that branch).
(
  cd "$WORK_A"
  git add docs/context/gate-skip-acceptances.jsonl
  git commit -q -m "chore(gate-ledger): accept Phase 995 e2e skip"
  git branch -m trunk
  git push -q origin trunk
  # Point the bare "origin"'s HEAD at trunk explicitly — an empty bare repo's
  # HEAD symbolic-ref defaults to whatever this git install's compiled/
  # configured default branch name is (main/master, version- and
  # config-dependent), which is NOT necessarily "trunk". Without this, a
  # plain `git clone` of $BARE checks out an empty tree (HEAD points at a
  # branch that was never pushed), even though trunk itself has commits.
  git --git-dir="$BARE" symbolic-ref HEAD refs/heads/trunk
)

# ---------------------------------------------------------------------------
# workB: a FRESH clone — simulates a sibling worktree / different machine /
# CI checkout. No local .claude/audit.jsonl carries over from workA. workB
# then independently records the SAME logical skip, but at T_SKIP_B — AFTER
# the acceptance's timestamp T_ACCEPT. This is the exact ordering Round 2's
# bug got wrong.
# ---------------------------------------------------------------------------
git clone -q "$BARE" "$WORK_B" 2>/dev/null

if [ -f "$WORK_B/docs/context/gate-skip-acceptances.jsonl" ]; then
  pass "fresh clone carries the committed acceptance file"
else
  fail "fresh clone carries the committed acceptance file" "not present in workB after clone"
fi

CONTENT_B=$(cat "$WORK_B/docs/context/gate-skip-acceptances.jsonl" 2>/dev/null)
if echo "$CONTENT_B" | grep -q "DB isolation fix tracked in #117"; then
  pass "cloned acceptance content matches what was committed"
else
  fail "cloned acceptance content matches what was committed" "$CONTENT_B"
fi

AUDIT_B="$WORK_B/.claude/audit.jsonl"
mkdir -p "$WORK_B/.claude"
CLOCK_TS="$T_SKIP_B" AUDIT_LOG_PATH="$AUDIT_B" bash "$EMIT_GATE" e2e skipped --reason "shared postgres container owned by another project" --epic E9950 --phase 995 >/dev/null 2>&1

set +e
(cd "$WORK_B" && AUDIT_LOG_PATH="$AUDIT_B" bash "$GATE_LEDGER_SH" --phase 995 --check-only >/dev/null 2>&1)
CHECK_EXIT=$?
set -e
if [ "$CHECK_EXIT" -eq 0 ]; then
  pass "fresh-clone check-only reconciles even though its own skip postdates the acceptance (durable, not a timestamp race)"
else
  fail "fresh-clone check-only reconciles despite skip-after-accept ordering" "exit=$CHECK_EXIT (T_SKIP_B=$T_SKIP_B > T_ACCEPT=$T_ACCEPT — this is exactly the Round 2 regression if it fails)"
fi

REPORT_B=$(cd "$WORK_B" && AUDIT_LOG_PATH="$AUDIT_B" GATE_LEDGER_PATH="$WORK_B/docs/context/gate-ledger.md" bash "$GATE_LEDGER_SH" --phase 995 2>&1)
if echo "$REPORT_B" | grep -q "✓ skips accepted"; then
  pass "regenerated report (from the fresh clone) shows the acceptance, not stripped"
else
  fail "regenerated report shows the acceptance" "$REPORT_B"
fi
if echo "$REPORT_B" | grep -q "⚠ 未結清"; then
  fail "regenerated report does NOT show the unreconciled warning marker" "marker present:
$REPORT_B"
else
  pass "regenerated report does NOT show the unreconciled warning marker"
fi

rm -rf "$WORK_A" "$WORK_B" "$(dirname "$BARE")"

echo ""
echo "Passed: $PASS | Failed: $FAIL"
[ "$FAIL" = "0" ] || exit 1
