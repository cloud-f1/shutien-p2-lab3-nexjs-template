#!/usr/bin/env bash
# scripts/flow-tests/test-flow-command.sh — /athena:flow command structure test
#
# Validates .claude/commands/athena/flow.md contains every required structure:
# Workflow tool grant, capability-probe + delegation, wave planning, the
# per-wave Workflow template (native agent({schema}), NO claude -p), write-back.
#
# Usage: bash scripts/flow-tests/test-flow-command.sh
# Exit: 0 = all pass, 1 = any failure. Runtime <2s.

set -uo pipefail

FLOW_MD=".claude/commands/athena/flow.md"
PASS=0
FAIL=0
RESULTS=()

pass() { PASS=$(( PASS + 1 )); RESULTS+=("  PASS: $1"); }
fail() {
  FAIL=$(( FAIL + 1 ))
  if [ -n "${2:-}" ]; then RESULTS+=("  FAIL: $1 — $2"); else RESULTS+=("  FAIL: $1"); fi
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FLOW_MD_PATH="$REPO_ROOT/$FLOW_MD"

if [ ! -f "$FLOW_MD_PATH" ]; then
  echo "ERROR: $FLOW_MD_PATH not found"
  exit 1
fi

# --- Task 1: frontmatter grants Workflow ---
if grep -qE '^allowed-tools:.*\bWorkflow\b' "$FLOW_MD_PATH"; then
  pass "frontmatter allowed-tools grants Workflow"
else
  fail "frontmatter allowed-tools grants Workflow" "no 'Workflow' in allowed-tools line"
fi

if grep -qE '^allowed-tools:.*\bAgent\b' "$FLOW_MD_PATH"; then
  pass "frontmatter allowed-tools grants Agent (delegation path)"
else
  fail "frontmatter allowed-tools grants Agent (delegation path)" "no 'Agent' in allowed-tools line"
fi

# --- Task 2: capability probe + delegation ---
if grep -q 'flow_delegated_to_batch' "$FLOW_MD_PATH"; then
  pass "delegation emits flow_delegated_to_batch audit event"
else
  fail "delegation emits flow_delegated_to_batch audit event" "missing 'flow_delegated_to_batch'"
fi

if grep -q 'audit-emit-pipeline.sh' "$FLOW_MD_PATH"; then
  pass "uses audit-emit-pipeline.sh helper"
else
  fail "uses audit-emit-pipeline.sh helper" "missing 'audit-emit-pipeline.sh'"
fi

if grep -qi '/athena:batch' "$FLOW_MD_PATH"; then
  pass "delegation target /athena:batch named"
else
  fail "delegation target /athena:batch named" "missing '/athena:batch'"
fi

# --- Task 3: wave planning + resume ---
if grep -q 'epic-graph.sh --json --pending-only' "$FLOW_MD_PATH"; then
  pass "plans waves via epic-graph.sh --json --pending-only"
else
  fail "plans waves via epic-graph.sh --json --pending-only" "missing pending-only graph call"
fi

if grep -q 'epic-progress.md' "$FLOW_MD_PATH"; then
  pass "reads epic-progress.md for resume/skip"
else
  fail "reads epic-progress.md for resume/skip" "missing 'epic-progress.md'"
fi

# --- Task 4: per-wave Workflow template ---
for field in '"status"' '"filesChanged"' '"worktreePath"' '"worktreeBranch"' '"summary"'; do
  if grep -q "$field" "$FLOW_MD_PATH"; then
    pass "AgentReport schema has $field"
  else
    fail "AgentReport schema has $field" "missing $field"
  fi
done

if grep -q 'pipeline(' "$FLOW_MD_PATH"; then
  pass "wave uses pipeline() per-epic dispatch"
else
  fail "wave uses pipeline() per-epic dispatch" "missing 'pipeline('"
fi

if grep -q "isolation:" "$FLOW_MD_PATH" && grep -q 'worktree' "$FLOW_MD_PATH"; then
  pass "implement stage is worktree-isolated"
else
  fail "implement stage is worktree-isolated" "missing isolation:'worktree'"
fi

if grep -q 'budget.remaining' "$FLOW_MD_PATH"; then
  pass "wave guards on budget.remaining()"
else
  fail "wave guards on budget.remaining()" "missing budget.remaining()"
fi

# Hard guarantee: flow must NEVER INVOKE claude -p (the whole point vs batch).
# Prose negations ("no claude -p", "never claude -p") are allowed; fail only if a
# 'claude -p' occurrence is NOT in a negation context (i.e. a possible invocation).
if grep 'claude -p' "$FLOW_MD_PATH" | grep -vqiE 'no claude -p|never[^.]*claude -p|not[^.]*claude -p|without[^.]*claude -p'; then
  fail "no claude -p invocation" "a 'claude -p' occurrence is not a prose negation"
else
  pass "no claude -p invocation (only prose negations present)"
fi

# --- Task 5: wave loop + write-back + no-merge ---
if grep -q 'orchestration-log.md' "$FLOW_MD_PATH"; then
  pass "write-back appends orchestration-log.md"
else
  fail "write-back appends orchestration-log.md" "missing 'orchestration-log.md'"
fi

# Merge must be explicitly excluded from the workflow span.
if grep -qiE 'do not merge|merge stays|never merge|merge.*outer' "$FLOW_MD_PATH"; then
  pass "merge explicitly excluded from flow"
else
  fail "merge explicitly excluded from flow" "no statement that merge stays outside flow"
fi

if grep -qE 'MAX_ITERATIONS|count.?cap|count cap' "$FLOW_MD_PATH"; then
  pass "outer loop has a count-cap budget backstop"
else
  fail "outer loop has a count-cap budget backstop" "missing count-cap / MAX_ITERATIONS backstop"
fi

# --- Validation: no silent wave truncation (E199 no-silent-caps) ---
# CAP must limit concurrency (chunked batches), never truncate the work list.
if grep -qE 'slice\(0, *CAP\)' "$FLOW_MD_PATH"; then
  fail "no silent wave truncation" "uses WAVE.slice(0,CAP) — drops epics beyond CAP"
else
  pass "no silent wave truncation (CAP limits concurrency, not work list)"
fi

# --- summary ---
printf '%s\n' "${RESULTS[@]}"
echo "----"
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
