#!/usr/bin/env bash
# E186 — Memory Metrics fixture tests.
#
# Covers acceptance criteria from docs/epics/e186-memory-metrics-dashboard.md:
#
#   t1  — top-N rank order (descending hits)
#   t2  — strength histogram bucketing (5 ranges)
#   t3  — citation map per-agent groupby
#   t4  — archive churn ratio (with revives)
#   t5  — archive churn ratio (no revives — null avg)
#   t6  — inject hit-rate Block A vs Block B distinction
#   t7  — JSON output is valid + has expected sections
#   t8  — missing audit-log handled gracefully (empty-state message)
#   t9  — missing template-memory dir handled gracefully
#   t10 — --epic filter restricts events
#   t11 — --since filter restricts events
#   t12 — premature-promotion count integration with promotion-follow-through.sh
#
# Tests run in isolated temp directories; the real ~/.claude/template-memory
# and the repo's audit.jsonl are NEVER touched.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/memory/metrics.sh"
SCORE_SH="$REPO_ROOT/scripts/memory/score.sh"
PFT_SH="$REPO_ROOT/scripts/memory/promotion-follow-through.sh"

[ -x "$SCRIPT" ] || chmod +x "$SCRIPT" 2>/dev/null || true

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

# Build a minimal Tier 0 lesson with a given strength frontmatter.
make_lesson_with_strength() {
  local path="$1" strength="$2" created="${3:-2026-03-07}" rc="${4:-0}"
  cat > "$path" <<EOF
---
created: $created
retrieval_count: $rc
half_life_days: 365
strength: $strength
tier: 0
---
# $(basename "$path")
fixture content.
EOF
}

# Append an audit event line.
emit_audit() {
  local audit="$1"; shift
  echo "$@" >> "$audit"
}

# ---- t1: top-N rank order (descending hits) ------------------------------
t1_top_n_rank_order() {
  local dir; dir=$(mktemp -d -p "$TMP" t1.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"

  # 3 hits for "popular.md", 2 for "medium.md", 1 for "rare.md"
  for i in 1 2 3; do
    emit_audit "$audit" '{"ts":"2026-04-01T10:00:0'"$i"'Z","event":"agent_cited","agent":"reviewer","lesson":"popular.md","epic":"E186"}'
  done
  for i in 1 2; do
    emit_audit "$audit" '{"ts":"2026-04-02T10:00:0'"$i"'Z","event":"tier0_loaded","lesson":"medium.md","agent":"session-start","epic":"E186"}'
  done
  emit_audit "$audit" '{"ts":"2026-04-03T10:00:01Z","event":"rule_fired","rule_id":21,"severity":"block","lesson":"rare.md","epic":"E186"}'

  local out
  out=$(AUDIT_LOG_PATH="$audit" \
        TEMPLATE_MEMORY_DIR="$dir" \
        STRENGTH_NOW="2026-05-07" \
        "$SCRIPT" --json 2>/dev/null)

  local first second third
  first=$(echo "$out"  | jq -r '.top_retrieved[0].lesson')
  second=$(echo "$out" | jq -r '.top_retrieved[1].lesson')
  third=$(echo "$out"  | jq -r '.top_retrieved[2].lesson')
  local hits1
  hits1=$(echo "$out"  | jq -r '.top_retrieved[0].hits')

  if [ "$first" = "popular.md" ] && [ "$second" = "medium.md" ] && [ "$third" = "rare.md" ] && [ "$hits1" = "3" ]; then
    pass "top-N ranks descending: popular(3) > medium(2) > rare(1)"
  else
    fail "top-N rank order" "got [$first, $second, $third] hits1=$hits1"
  fi
}

# ---- t2: strength histogram bucketing (5 ranges) -------------------------
t2_strength_histogram_buckets() {
  local dir; dir=$(mktemp -d -p "$TMP" t2.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"

  # weak [0.0, 0.1)
  make_lesson_with_strength "$dir/weak.md" "0.05"
  # decay [0.1, 0.3)
  make_lesson_with_strength "$dir/decay1.md" "0.20"
  make_lesson_with_strength "$dir/decay2.md" "0.25"
  # active [0.3, 0.6)
  make_lesson_with_strength "$dir/active.md" "0.45"
  # strong [0.6, 0.9)
  make_lesson_with_strength "$dir/strong1.md" "0.75"
  make_lesson_with_strength "$dir/strong2.md" "0.80"
  make_lesson_with_strength "$dir/strong3.md" "0.65"
  # saturated [0.9, 1.0]
  make_lesson_with_strength "$dir/sat.md" "0.95"

  local out
  out=$(AUDIT_LOG_PATH="$audit" \
        TEMPLATE_MEMORY_DIR="$dir" \
        STRENGTH_NOW="2026-05-07" \
        "$SCRIPT" --json 2>/dev/null)

  local weak decay active strong sat total
  weak=$(echo   "$out" | jq '.strength_histogram.buckets[0].count')
  decay=$(echo  "$out" | jq '.strength_histogram.buckets[1].count')
  active=$(echo "$out" | jq '.strength_histogram.buckets[2].count')
  strong=$(echo "$out" | jq '.strength_histogram.buckets[3].count')
  sat=$(echo    "$out" | jq '.strength_histogram.buckets[4].count')
  total=$(echo  "$out" | jq '.strength_histogram.total')

  if [ "$weak" = "1" ] && [ "$decay" = "2" ] && [ "$active" = "1" ] \
     && [ "$strong" = "3" ] && [ "$sat" = "1" ] && [ "$total" = "8" ]; then
    pass "histogram buckets: weak=1 decay=2 active=1 strong=3 sat=1 total=8"
  else
    fail "strength histogram bucketing" "got weak=$weak decay=$decay active=$active strong=$strong sat=$sat total=$total"
  fi
}

# ---- t3: citation map per-agent groupby ----------------------------------
t3_citation_map_per_agent() {
  local dir; dir=$(mktemp -d -p "$TMP" t3.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"

  emit_audit "$audit" '{"ts":"2026-04-01T10:00:01Z","event":"agent_cited","agent":"reviewer","lesson":"anti-patterns.md","epic":"E186"}'
  emit_audit "$audit" '{"ts":"2026-04-01T10:00:02Z","event":"agent_cited","agent":"reviewer","lesson":"anti-patterns.md","epic":"E186"}'
  emit_audit "$audit" '{"ts":"2026-04-01T10:00:03Z","event":"agent_cited","agent":"reviewer","lesson":"workflow-patterns.md","epic":"E186"}'
  emit_audit "$audit" '{"ts":"2026-04-02T10:00:01Z","event":"agent_cited","agent":"qa","lesson":"testing-patterns.md","epic":"E186"}'

  local out
  out=$(AUDIT_LOG_PATH="$audit" \
        TEMPLATE_MEMORY_DIR="$dir" \
        STRENGTH_NOW="2026-05-07" \
        "$SCRIPT" --json 2>/dev/null)

  local agents reviewer_total qa_total reviewer_top_lesson reviewer_top_count
  agents=$(echo "$out" | jq '.citation_map | length')
  reviewer_total=$(echo "$out" | jq '.citation_map[] | select(.agent == "reviewer") | .total_citations')
  qa_total=$(echo "$out"       | jq '.citation_map[] | select(.agent == "qa")       | .total_citations')
  reviewer_top_lesson=$(echo "$out" | jq -r '.citation_map[] | select(.agent == "reviewer") | .lessons[0].lesson')
  reviewer_top_count=$(echo  "$out" | jq    '.citation_map[] | select(.agent == "reviewer") | .lessons[0].count')

  if [ "$agents" = "2" ] && [ "$reviewer_total" = "3" ] && [ "$qa_total" = "1" ] \
     && [ "$reviewer_top_lesson" = "anti-patterns.md" ] && [ "$reviewer_top_count" = "2" ]; then
    pass "citation map: reviewer cited 3x (top: anti-patterns.md x2), qa cited 1x"
  else
    fail "citation map per-agent" "agents=$agents reviewer_total=$reviewer_total qa_total=$qa_total top=$reviewer_top_lesson($reviewer_top_count)"
  fi
}

# ---- t4: archive churn ratio (with revives) ------------------------------
t4_archive_churn_with_revives() {
  local dir; dir=$(mktemp -d -p "$TMP" t4.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"

  # Lesson archived 2026-03-01, revived 2026-03-15 (14 days later)
  emit_audit "$audit" '{"ts":"2026-03-01T10:00:00Z","event":"lesson_archived","lesson":"a.md","strength":0.05,"threshold":0.10,"epic":"E184"}'
  emit_audit "$audit" '{"ts":"2026-03-15T10:00:00Z","event":"lesson_revived","lesson":"a.md","epic":"E184"}'
  # Another archived 2026-04-01, revived 2026-04-21 (20 days later)
  emit_audit "$audit" '{"ts":"2026-04-01T10:00:00Z","event":"lesson_archived","lesson":"b.md","strength":0.08,"threshold":0.10,"epic":"E184"}'
  emit_audit "$audit" '{"ts":"2026-04-21T10:00:00Z","event":"lesson_revived","lesson":"b.md","epic":"E184"}'
  # Third archive, no revive
  emit_audit "$audit" '{"ts":"2026-04-15T10:00:00Z","event":"lesson_archived","lesson":"c.md","strength":0.07,"threshold":0.10,"epic":"E184"}'

  local out
  out=$(AUDIT_LOG_PATH="$audit" \
        TEMPLATE_MEMORY_DIR="$dir" \
        STRENGTH_NOW="2026-05-07" \
        "$SCRIPT" --json 2>/dev/null)

  local arch rev avg
  arch=$(echo "$out" | jq '.archive_churn.archived')
  rev=$(echo  "$out" | jq '.archive_churn.revived')
  avg=$(echo  "$out" | jq '.archive_churn.avg_revive_days')

  # Average should be (14 + 20) / 2 = 17.0
  local avg_int
  avg_int=$(awk -v v="$avg" 'BEGIN { printf "%d", v + 0.5 }')

  if [ "$arch" = "3" ] && [ "$rev" = "2" ] && [ "$avg_int" = "17" ]; then
    pass "archive churn: 3 archived, 2 revived, avg_revive_days=17 (= (14+20)/2)"
  else
    fail "archive churn with revives" "arch=$arch rev=$rev avg=$avg avg_int=$avg_int"
  fi
}

# ---- t5: archive churn ratio (no revives — null avg) ---------------------
t5_archive_churn_no_revives() {
  local dir; dir=$(mktemp -d -p "$TMP" t5.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"

  emit_audit "$audit" '{"ts":"2026-03-01T10:00:00Z","event":"lesson_archived","lesson":"a.md","strength":0.05,"threshold":0.10,"epic":"E184"}'
  emit_audit "$audit" '{"ts":"2026-04-01T10:00:00Z","event":"lesson_archived","lesson":"b.md","strength":0.08,"threshold":0.10,"epic":"E184"}'

  local out
  out=$(AUDIT_LOG_PATH="$audit" \
        TEMPLATE_MEMORY_DIR="$dir" \
        STRENGTH_NOW="2026-05-07" \
        "$SCRIPT" --json 2>/dev/null)

  local arch rev avg
  arch=$(echo "$out" | jq '.archive_churn.archived')
  rev=$(echo  "$out" | jq '.archive_churn.revived')
  avg=$(echo  "$out" | jq '.archive_churn.avg_revive_days')

  if [ "$arch" = "2" ] && [ "$rev" = "0" ] && [ "$avg" = "null" ]; then
    pass "archive churn (no revives): arch=2 rev=0 avg=null"
  else
    fail "archive churn no revives" "arch=$arch rev=$rev avg=$avg"
  fi
}

# ---- t6: inject hit-rate Block A vs Block B distinction ------------------
t6_inject_hit_rate_block_a_vs_b() {
  local dir; dir=$(mktemp -d -p "$TMP" t6.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"

  # 3 Block A (PRIMER) loads, 7 Block B loads.
  for i in 1 2 3; do
    emit_audit "$audit" '{"ts":"2026-04-01T10:00:0'"$i"'Z","event":"tier0_loaded","lesson":"NEW_PROJECT_PRIMER.md","agent":"session-start","epic":"none"}'
  done
  for i in 1 2 3 4 5 6 7; do
    emit_audit "$audit" '{"ts":"2026-04-02T10:00:0'"$i"'Z","event":"tier0_loaded","lesson":"workflow-patterns.md","agent":"session-start","epic":"none"}'
  done

  local out
  out=$(AUDIT_LOG_PATH="$audit" \
        TEMPLATE_MEMORY_DIR="$dir" \
        STRENGTH_NOW="2026-05-07" \
        "$SCRIPT" --json 2>/dev/null)

  local a b rate
  a=$(echo "$out"    | jq '.inject_hit_rate.block_a')
  b=$(echo "$out"    | jq '.inject_hit_rate.block_b')
  rate=$(echo "$out" | jq -r '.inject_hit_rate.hit_rate_pct')

  # Expected hit-rate = 7 / 10 * 100 = 70.0
  local rate_int
  rate_int=$(awk -v v="$rate" 'BEGIN { printf "%d", v + 0.5 }')

  if [ "$a" = "3" ] && [ "$b" = "7" ] && [ "$rate_int" = "70" ]; then
    pass "inject hit-rate: Block A=3, Block B=7, rate=70.0%"
  else
    fail "inject hit-rate" "a=$a b=$b rate=$rate rate_int=$rate_int"
  fi
}

# ---- t7: JSON output is valid + has expected sections --------------------
t7_json_output_valid_and_shaped() {
  local dir; dir=$(mktemp -d -p "$TMP" t7.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"
  make_lesson_with_strength "$dir/x.md" "0.5"
  emit_audit "$audit" '{"ts":"2026-04-01T10:00:01Z","event":"agent_cited","agent":"reviewer","lesson":"x.md","epic":"E186"}'

  local out
  out=$(AUDIT_LOG_PATH="$audit" \
        TEMPLATE_MEMORY_DIR="$dir" \
        STRENGTH_NOW="2026-05-07" \
        "$SCRIPT" --json 2>/dev/null)

  if ! echo "$out" | jq -e . >/dev/null 2>&1; then
    fail "json output valid" "not valid JSON: $out"
    return
  fi

  # Verify each required section key exists.
  local missing=""
  for key in generated_at filters top_retrieved strength_histogram \
             citation_map archive_churn strength_activity inject_hit_rate \
             stale_promotions_count; do
    if ! echo "$out" | jq -e "has(\"$key\")" >/dev/null 2>&1 \
       || [ "$(echo "$out" | jq -r "has(\"$key\")")" != "true" ]; then
      missing="$missing $key"
    fi
  done

  if [ -z "$missing" ]; then
    pass "JSON output has all 9 required top-level keys"
  else
    fail "json shape" "missing keys:$missing"
  fi
}

# ---- t8: missing audit-log handled gracefully ----------------------------
t8_missing_audit_log_handled() {
  local dir; dir=$(mktemp -d -p "$TMP" t8.XXXXXX)
  # Note: do NOT create $dir/audit.jsonl

  local out rc
  out=$(AUDIT_LOG_PATH="$dir/nonexistent.jsonl" \
        TEMPLATE_MEMORY_DIR="$dir" \
        STRENGTH_NOW="2026-05-07" \
        "$SCRIPT" 2>/dev/null)
  rc=$?

  if [ "$rc" -eq 0 ] && echo "$out" | grep -q "No memory metrics recorded yet"; then
    pass "missing audit log → exits 0 with empty-state markdown"
  else
    fail "missing audit log handled" "rc=$rc out=$out"
  fi
}

# ---- t9: missing template-memory dir handled gracefully ------------------
t9_missing_template_memory_handled() {
  local dir; dir=$(mktemp -d -p "$TMP" t9.XXXXXX)
  local audit="$dir/audit.jsonl"
  emit_audit "$audit" '{"ts":"2026-04-01T10:00:01Z","event":"agent_cited","agent":"reviewer","lesson":"x.md","epic":"E186"}'

  local out rc
  out=$(AUDIT_LOG_PATH="$audit" \
        TEMPLATE_MEMORY_DIR="$dir/does-not-exist" \
        STRENGTH_NOW="2026-05-07" \
        "$SCRIPT" --json 2>/dev/null)
  rc=$?

  # Should still produce valid JSON; histogram total should be 0 + missing flag.
  local total missing
  total=$(echo "$out" | jq '.strength_histogram.total')
  missing=$(echo "$out" | jq '.strength_histogram.missing // false')

  if [ "$rc" -eq 0 ] && [ "$total" = "0" ] && [ "$missing" = "true" ]; then
    pass "missing template-memory dir → exits 0, histogram.total=0, missing=true"
  else
    fail "missing template-memory" "rc=$rc total=$total missing=$missing"
  fi
}

# ---- t10: --epic filter restricts events ---------------------------------
t10_epic_filter_restricts() {
  local dir; dir=$(mktemp -d -p "$TMP" t10.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"

  emit_audit "$audit" '{"ts":"2026-04-01T10:00:01Z","event":"agent_cited","agent":"reviewer","lesson":"in-epic.md","epic":"E186"}'
  emit_audit "$audit" '{"ts":"2026-04-01T10:00:02Z","event":"agent_cited","agent":"reviewer","lesson":"out-epic.md","epic":"E999"}'

  local out_all out_filtered
  out_all=$(AUDIT_LOG_PATH="$audit" TEMPLATE_MEMORY_DIR="$dir" STRENGTH_NOW="2026-05-07" \
            "$SCRIPT" --json 2>/dev/null)
  out_filtered=$(AUDIT_LOG_PATH="$audit" TEMPLATE_MEMORY_DIR="$dir" STRENGTH_NOW="2026-05-07" \
                 "$SCRIPT" --epic E186 --json 2>/dev/null)

  local all_count filtered_count filtered_lesson
  all_count=$(echo "$out_all"      | jq '.top_retrieved | length')
  filtered_count=$(echo "$out_filtered" | jq '.top_retrieved | length')
  filtered_lesson=$(echo "$out_filtered" | jq -r '.top_retrieved[0].lesson')

  if [ "$all_count" = "2" ] && [ "$filtered_count" = "1" ] && [ "$filtered_lesson" = "in-epic.md" ]; then
    pass "--epic E186 filter: 2 events total, 1 after filter (in-epic.md only)"
  else
    fail "--epic filter" "all=$all_count filtered=$filtered_count filtered_lesson=$filtered_lesson"
  fi
}

# ---- t11: --since filter restricts events --------------------------------
t11_since_filter_restricts() {
  local dir; dir=$(mktemp -d -p "$TMP" t11.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"

  emit_audit "$audit" '{"ts":"2026-01-01T10:00:01Z","event":"agent_cited","agent":"reviewer","lesson":"old.md","epic":"E186"}'
  emit_audit "$audit" '{"ts":"2026-04-01T10:00:01Z","event":"agent_cited","agent":"reviewer","lesson":"new.md","epic":"E186"}'

  local out_filtered
  out_filtered=$(AUDIT_LOG_PATH="$audit" TEMPLATE_MEMORY_DIR="$dir" STRENGTH_NOW="2026-05-07" \
                 "$SCRIPT" --since 2026-03-01 --json 2>/dev/null)

  local count lesson
  count=$(echo "$out_filtered" | jq '.top_retrieved | length')
  lesson=$(echo "$out_filtered" | jq -r '.top_retrieved[0].lesson')

  if [ "$count" = "1" ] && [ "$lesson" = "new.md" ]; then
    pass "--since 2026-03-01 filter: only new.md (post-cutoff) appears"
  else
    fail "--since filter" "count=$count lesson=$lesson"
  fi
}

# ---- t12: integration with promotion-follow-through.sh -------------------
t12_integration_with_promotion_follow_through() {
  local dir; dir=$(mktemp -d -p "$TMP" t12.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"

  # Two stale lessons (61d old, rc=0, no audit retrieval) — both should flag.
  make_lesson_with_strength "$dir/stale1.md" "0.5" "2026-03-07" 0
  make_lesson_with_strength "$dir/stale2.md" "0.5" "2026-03-08" 0
  # One young lesson — should NOT flag.
  make_lesson_with_strength "$dir/young.md"  "0.5" "2026-04-30" 0

  local out
  out=$(AUDIT_LOG_PATH="$audit" \
        TEMPLATE_MEMORY_DIR="$dir" \
        STRENGTH_NOW="2026-05-07" \
        "$SCRIPT" --json 2>/dev/null)

  local count
  count=$(echo "$out" | jq '.stale_promotions_count')

  if [ "$count" = "2" ]; then
    pass "stale_promotions_count integration: 2 stale lessons detected (1 young excluded)"
  else
    fail "stale promotions integration" "expected 2, got $count; out=$out"
  fi
}

echo "=== E186: memory metrics dashboard ==="
t1_top_n_rank_order
t2_strength_histogram_buckets
t3_citation_map_per_agent
t4_archive_churn_with_revives
t5_archive_churn_no_revives
t6_inject_hit_rate_block_a_vs_b
t7_json_output_valid_and_shaped
t8_missing_audit_log_handled
t9_missing_template_memory_handled
t10_epic_filter_restricts
t11_since_filter_restricts
t12_integration_with_promotion_follow_through

TOTAL=$((PASS + FAIL))
echo "----"
echo "$PASS/$TOTAL passed"

if [ $FAIL -gt 0 ]; then
  echo "first failure: $FIRST_FAIL" >&2
  exit 1
fi
exit 0
