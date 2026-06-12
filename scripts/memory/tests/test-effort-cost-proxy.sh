#!/usr/bin/env bash
# Fixture-driven unit tests for E207 — Effort Cost Proxy in metrics.sh
#
# Tests:
#   - Mixed audit log (2 pre-E207 events + 3 post-E207 events):
#     * Cost-proxy table sums ONLY enriched (post-E207) events
#     * Old (pre-E207) events do NOT crash the dashboard
#     * Old events still appear in tier distribution count
#   - Cost proxy formula: (reviewer_weight + evaluator_weight) × max_concurrent
#     weights: haiku=1, sonnet=5, opus=25
#   - Missing fields are handled via "unknown" fallback (no crash, no NaN)
#
# Run: bash scripts/memory/tests/test-effort-cost-proxy.sh
# Must pass in <3s with no external dependencies beyond jq + bash

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
METRICS_SH="$SCRIPT_DIR/../metrics.sh"

if [ ! -f "$METRICS_SH" ]; then
  echo "FAIL: metrics.sh not found at $METRICS_SH" >&2
  exit 1
fi

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() {
  echo "FAIL: $1"
  echo "  Expected: $2"
  echo "  Got:      $3"
  FAIL=$((FAIL + 1))
}

# Require jq for these tests (the cost-proxy feature requires jq)
if ! command -v jq >/dev/null 2>&1; then
  echo "SKIP: jq not available — E207 cost-proxy tests skipped"
  exit 0
fi

TMPDIR_TEST=$(mktemp -d)
trap 'rm -rf "$TMPDIR_TEST"' EXIT

# ---------------------------------------------------------------------------
# Fixture: mixed audit log (2 pre-E207 + 3 post-E207 effort_resolved events)
# ---------------------------------------------------------------------------
MIXED_LOG="$TMPDIR_TEST/mixed-audit.jsonl"
cat > "$MIXED_LOG" <<'EOF'
{"ts":"2026-01-01T10:00:00Z","event":"effort_resolved","tier":"standard","source":"default"}
{"ts":"2026-01-02T10:00:00Z","event":"effort_resolved","tier":"thorough","source":"env"}
{"ts":"2026-06-01T10:00:00Z","event":"effort_resolved","tier":"quick","source":"flag","model_map":"reviewer=haiku,evaluator=sonnet","max_concurrent":1,"verify_posture":"single-vote"}
{"ts":"2026-06-01T11:00:00Z","event":"effort_resolved","tier":"standard","source":"default","model_map":"reviewer=sonnet,evaluator=sonnet","max_concurrent":4,"verify_posture":"single-vote"}
{"ts":"2026-06-01T12:00:00Z","event":"effort_resolved","tier":"ultra","source":"flag","model_map":"reviewer=opus,evaluator=opus","max_concurrent":8,"verify_posture":"judge-panel+adversarial+multimodal"}
EOF

# ---------------------------------------------------------------------------
# Test 1: metrics.sh --effort runs without error on mixed log
# ---------------------------------------------------------------------------
out=$(AUDIT_LOG_PATH="$MIXED_LOG" bash "$METRICS_SH" --effort 2>&1)
exit_code=$?
if [ "$exit_code" = "0" ]; then
  pass "metrics.sh --effort exits 0 on mixed pre/post-E207 audit log"
else
  fail "metrics.sh --effort exits 0 on mixed audit log" "0" "$exit_code"
fi

# ---------------------------------------------------------------------------
# Test 2: tier distribution includes ALL 5 events (pre and post E207)
# ---------------------------------------------------------------------------
tier_dist_json=$(AUDIT_LOG_PATH="$MIXED_LOG" bash "$METRICS_SH" --effort --json 2>/dev/null \
  | jq '.effort_metrics.tier_distribution // []')
total_dist=$(echo "$tier_dist_json" | jq '[.[].count] | add // 0')
if [ "$total_dist" = "5" ]; then
  pass "tier distribution counts all 5 events (pre + post E207)"
else
  fail "tier distribution counts all 5 events" "5" "$total_dist"
fi

# ---------------------------------------------------------------------------
# Test 3: cost proxy table only sums 3 post-E207 (enriched) events
# ---------------------------------------------------------------------------
cost_proxy_json=$(AUDIT_LOG_PATH="$MIXED_LOG" bash "$METRICS_SH" --effort --json 2>/dev/null \
  | jq '.effort_metrics.effort_cost_proxy // []')
enriched_count=$(echo "$cost_proxy_json" | jq '[.[].invocations] | add // 0')
if [ "$enriched_count" = "3" ]; then
  pass "cost proxy table counts only 3 enriched (post-E207) events"
else
  fail "cost proxy table counts only 3 enriched events" "3" "$enriched_count"
fi

# ---------------------------------------------------------------------------
# Test 4: cost proxy formula — quick tier
# quick: haiku=1 + sonnet=1 = 2... wait: reviewer=haiku(1) + evaluator=sonnet(5) = 6
# max_concurrent=1 → cost_proxy_per_run = (1 + 5) × 1 = 6
# ---------------------------------------------------------------------------
quick_proxy=$(echo "$cost_proxy_json" \
  | jq 'map(select(.tier == "quick")) | .[0].cost_proxy_per_run // -1')
if [ "$quick_proxy" = "6" ]; then
  pass "quick tier cost_proxy_per_run = (haiku=1 + sonnet=5) × 1 = 6"
else
  fail "quick tier cost_proxy_per_run" "6" "$quick_proxy"
fi

# ---------------------------------------------------------------------------
# Test 5: cost proxy formula — standard tier
# standard: reviewer=sonnet(5) + evaluator=sonnet(5) = 10 × max_concurrent=4 = 40
# ---------------------------------------------------------------------------
standard_proxy=$(echo "$cost_proxy_json" \
  | jq 'map(select(.tier == "standard")) | .[0].cost_proxy_per_run // -1')
if [ "$standard_proxy" = "40" ]; then
  pass "standard tier cost_proxy_per_run = (sonnet=5 + sonnet=5) × 4 = 40"
else
  fail "standard tier cost_proxy_per_run" "40" "$standard_proxy"
fi

# ---------------------------------------------------------------------------
# Test 6: cost proxy formula — ultra tier
# ultra: reviewer=opus(25) + evaluator=opus(25) = 50 × max_concurrent=8 = 400
# ---------------------------------------------------------------------------
ultra_proxy=$(echo "$cost_proxy_json" \
  | jq 'map(select(.tier == "ultra")) | .[0].cost_proxy_per_run // -1')
if [ "$ultra_proxy" = "400" ]; then
  pass "ultra tier cost_proxy_per_run = (opus=25 + opus=25) × 8 = 400"
else
  fail "ultra tier cost_proxy_per_run" "400" "$ultra_proxy"
fi

# ---------------------------------------------------------------------------
# Test 7: pre-E207 events are NOT in the cost proxy table (no model_map field)
# The 2 old events (standard + thorough) should NOT appear in cost_proxy rows
# ---------------------------------------------------------------------------
old_in_proxy=$(echo "$cost_proxy_json" \
  | jq 'map(select(.tier == "thorough")) | length')
if [ "$old_in_proxy" = "0" ]; then
  pass "pre-E207 thorough event not in cost proxy table (excluded from sum)"
else
  fail "pre-E207 thorough event should not appear in cost proxy" "0" "$old_in_proxy"
fi

# ---------------------------------------------------------------------------
# Test 8: metrics output contains "Effort Cost Proxy" heading (markdown mode)
# ---------------------------------------------------------------------------
md_out=$(AUDIT_LOG_PATH="$MIXED_LOG" bash "$METRICS_SH" --effort 2>/dev/null)
if echo "$md_out" | grep -q "Effort Cost Proxy"; then
  pass "markdown output contains 'Effort Cost Proxy' section heading"
else
  fail "markdown output contains 'Effort Cost Proxy'" "heading found" "not found"
fi

# ---------------------------------------------------------------------------
# Test 9: empty audit log — no crash
# ---------------------------------------------------------------------------
EMPTY_LOG="$TMPDIR_TEST/empty-audit.jsonl"
touch "$EMPTY_LOG"
empty_exit=$(AUDIT_LOG_PATH="$EMPTY_LOG" bash "$METRICS_SH" --effort 2>&1; echo "exit:$?")
if echo "$empty_exit" | grep -q "exit:0"; then
  pass "empty audit log — no crash (exit 0)"
else
  fail "empty audit log should exit 0" "exit:0" "$(echo "$empty_exit" | tail -1)"
fi

# ---------------------------------------------------------------------------
# Test 10: all-pre-E207 log — cost proxy table is empty, no crash
# ---------------------------------------------------------------------------
OLD_ONLY_LOG="$TMPDIR_TEST/old-only.jsonl"
cat > "$OLD_ONLY_LOG" <<'EOF'
{"ts":"2026-01-01T10:00:00Z","event":"effort_resolved","tier":"standard","source":"default"}
{"ts":"2026-01-02T10:00:00Z","event":"effort_resolved","tier":"thorough","source":"env"}
EOF
old_only_proxy=$(AUDIT_LOG_PATH="$OLD_ONLY_LOG" bash "$METRICS_SH" --effort --json 2>/dev/null \
  | jq '.effort_metrics.effort_cost_proxy // [] | length')
if [ "$old_only_proxy" = "0" ]; then
  pass "all-pre-E207 log: cost proxy table is empty, no crash"
else
  fail "all-pre-E207 log: cost proxy should be empty" "0" "$old_only_proxy"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  exit 1
else
  echo "All tests passed."
  exit 0
fi
