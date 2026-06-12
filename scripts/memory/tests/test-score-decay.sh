#!/usr/bin/env bash
# E197 — score.sh decay idempotency fixtures.
#
# Asserts that calling `score.sh decay-all` N times on the same calendar day
# against a temp lesson yields the same strength as calling it once.
#
# Tests run in isolated temp directories; the real ~/.claude/template-memory
# and the repo's audit.jsonl are NEVER touched.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SCORE_SH="$REPO_ROOT/scripts/memory/score.sh"

[ -x "$SCORE_SH" ] || chmod +x "$SCORE_SH" 2>/dev/null || true

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

# Create a minimal Tier 0 lesson with frontmatter.
make_lesson() {
  local path="$1" strength="${2:-0.5}" last_retrieved="${3:-2026-05-07}" hl="${4:-180}"
  cat > "$path" <<EOF
---
tier: 0
strength: $strength
half_life_days: $hl
last_retrieved: $last_retrieved
retrieval_count: 0
created: 2026-05-07
---
# Test Lesson

Body text for testing.
EOF
}

AUDIT="$TMP/audit.jsonl"
DEDUP="$TMP/dedup"
TODAY="2026-06-01"  # Fixed date so test is deterministic

# ---- test 1: single decay call produces expected output -----------------------

T1_DIR="$TMP/t1"
mkdir -p "$T1_DIR"
make_lesson "$T1_DIR/test-lesson.md" 0.5 "2026-05-07" 180

s_once=$(
  TEMPLATE_MEMORY_DIR="$T1_DIR" \
  ALLOW_TIER0_WRITE=1 \
  AUDIT_LOG_PATH="$AUDIT" \
  STRENGTH_DEDUP_DIR="$DEDUP" \
  STRENGTH_NOW="$TODAY" \
  "$SCORE_SH" decay "$T1_DIR/test-lesson.md"
)

if [ -n "$s_once" ]; then
  pass "single decay call produces a strength value"
else
  fail "single decay call produces a strength value" "got empty output"
fi

# ---- test 2: second decay call on same day is idempotent (same strength) -----

T2_DIR="$TMP/t2"
mkdir -p "$T2_DIR"
make_lesson "$T2_DIR/test-lesson.md" 0.5 "2026-05-07" 180

# First call
s_first=$(
  TEMPLATE_MEMORY_DIR="$T2_DIR" \
  ALLOW_TIER0_WRITE=1 \
  AUDIT_LOG_PATH="$AUDIT" \
  STRENGTH_DEDUP_DIR="$DEDUP" \
  STRENGTH_NOW="$TODAY" \
  "$SCORE_SH" decay "$T2_DIR/test-lesson.md"
)

# Second call same day — should produce same strength because last_decayed is now TODAY
s_second=$(
  TEMPLATE_MEMORY_DIR="$T2_DIR" \
  ALLOW_TIER0_WRITE=1 \
  AUDIT_LOG_PATH="$AUDIT" \
  STRENGTH_DEDUP_DIR="$DEDUP" \
  STRENGTH_NOW="$TODAY" \
  "$SCORE_SH" decay "$T2_DIR/test-lesson.md"
)

if [ "$s_first" = "$s_second" ]; then
  pass "two decay calls on same day produce identical strength (idempotent)"
else
  fail "two decay calls on same day produce identical strength (idempotent)" \
    "first=$s_first second=$s_second (should be equal — last_decayed anchor not written)"
fi

# ---- test 3: three decay calls on same day all yield same strength ------------

T3_DIR="$TMP/t3"
mkdir -p "$T3_DIR"
make_lesson "$T3_DIR/test-lesson.md" 0.5 "2026-05-07" 180

s_a=$(
  TEMPLATE_MEMORY_DIR="$T3_DIR" \
  ALLOW_TIER0_WRITE=1 \
  AUDIT_LOG_PATH="$AUDIT" \
  STRENGTH_DEDUP_DIR="$DEDUP" \
  STRENGTH_NOW="$TODAY" \
  "$SCORE_SH" decay "$T3_DIR/test-lesson.md"
)
s_b=$(
  TEMPLATE_MEMORY_DIR="$T3_DIR" \
  ALLOW_TIER0_WRITE=1 \
  AUDIT_LOG_PATH="$AUDIT" \
  STRENGTH_DEDUP_DIR="$DEDUP" \
  STRENGTH_NOW="$TODAY" \
  "$SCORE_SH" decay "$T3_DIR/test-lesson.md"
)
s_c=$(
  TEMPLATE_MEMORY_DIR="$T3_DIR" \
  ALLOW_TIER0_WRITE=1 \
  AUDIT_LOG_PATH="$AUDIT" \
  STRENGTH_DEDUP_DIR="$DEDUP" \
  STRENGTH_NOW="$TODAY" \
  "$SCORE_SH" decay "$T3_DIR/test-lesson.md"
)

if [ "$s_a" = "$s_b" ] && [ "$s_b" = "$s_c" ]; then
  pass "three decay calls on same day produce identical strength"
else
  fail "three decay calls on same day produce identical strength" \
    "a=$s_a b=$s_b c=$s_c"
fi

# ---- test 4: last_decayed field is written back to frontmatter ---------------

T4_DIR="$TMP/t4"
mkdir -p "$T4_DIR"
make_lesson "$T4_DIR/test-lesson.md" 0.5 "2026-05-07" 180

TEMPLATE_MEMORY_DIR="$T4_DIR" \
ALLOW_TIER0_WRITE=1 \
AUDIT_LOG_PATH="$AUDIT" \
STRENGTH_DEDUP_DIR="$DEDUP" \
STRENGTH_NOW="$TODAY" \
"$SCORE_SH" decay "$T4_DIR/test-lesson.md" >/dev/null

last_decayed=$(awk '
  BEGIN { in_fm=0; fm_count=0 }
  /^---[[:space:]]*$/ {
    fm_count++
    if (fm_count == 1) { in_fm=1; next }
    if (fm_count == 2) { exit }
  }
  in_fm && /^last_decayed:/ {
    sub(/^last_decayed:[[:space:]]+/, "")
    print
    exit
  }
' "$T4_DIR/test-lesson.md")

if [ "$last_decayed" = "$TODAY" ]; then
  pass "last_decayed field written back to frontmatter"
else
  fail "last_decayed field written back to frontmatter" \
    "got '$last_decayed' expected '$TODAY'"
fi

# ---- test 5: decay-all idempotency with half-life-defaults.json ---------------

T5_DIR="$TMP/t5"
mkdir -p "$T5_DIR"
# Create one lesson that appears in half-life-defaults.json
make_lesson "$T5_DIR/failure-patterns.md" 0.5 "2026-05-07" 30
# Copy the real defaults JSON (read-only, just referenced)
DEFAULTS_JSON="$REPO_ROOT/scripts/memory/half-life-defaults.json"

s_all_once=$(
  TEMPLATE_MEMORY_DIR="$T5_DIR" \
  ALLOW_TIER0_WRITE=1 \
  AUDIT_LOG_PATH="$AUDIT" \
  HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" \
  STRENGTH_DEDUP_DIR="$DEDUP" \
  STRENGTH_NOW="$TODAY" \
  "$SCORE_SH" decay-all "$T5_DIR" 2>&1
)

s_first_strength=$(
  ALLOW_TIER0_WRITE=1 \
  AUDIT_LOG_PATH="$AUDIT" \
  STRENGTH_DEDUP_DIR="$DEDUP" \
  STRENGTH_NOW="$TODAY" \
  "$SCORE_SH" get "$T5_DIR/failure-patterns.md"
)

# Second decay-all call — must produce same strength
s_all_twice=$(
  TEMPLATE_MEMORY_DIR="$T5_DIR" \
  ALLOW_TIER0_WRITE=1 \
  AUDIT_LOG_PATH="$AUDIT" \
  HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" \
  STRENGTH_DEDUP_DIR="$DEDUP" \
  STRENGTH_NOW="$TODAY" \
  "$SCORE_SH" decay-all "$T5_DIR" 2>&1
)

s_second_strength=$(
  ALLOW_TIER0_WRITE=1 \
  AUDIT_LOG_PATH="$AUDIT" \
  STRENGTH_DEDUP_DIR="$DEDUP" \
  STRENGTH_NOW="$TODAY" \
  "$SCORE_SH" get "$T5_DIR/failure-patterns.md"
)

if [ "$s_first_strength" = "$s_second_strength" ]; then
  pass "decay-all twice on same day yields same strength as once"
else
  fail "decay-all twice on same day yields same strength as once" \
    "after first=$s_first_strength after second=$s_second_strength"
fi

# ---- test 6: decay anchors to last_decayed when present ----------------------

T6_DIR="$TMP/t6"
mkdir -p "$T6_DIR"
# Lesson with last_decayed = TODAY (fresh decay) — should not change strength
make_lesson "$T6_DIR/test-lesson.md" 0.5 "2026-04-01" 180
# Set last_decayed to today manually
cat > "$T6_DIR/test-lesson.md" <<EOF
---
tier: 0
strength: 0.5
half_life_days: 180
last_retrieved: 2026-04-01
last_decayed: $TODAY
retrieval_count: 0
created: 2026-04-01
---
# Test Lesson

Body text.
EOF

s_today_anchor=$(
  TEMPLATE_MEMORY_DIR="$T6_DIR" \
  ALLOW_TIER0_WRITE=1 \
  AUDIT_LOG_PATH="$AUDIT" \
  STRENGTH_DEDUP_DIR="$DEDUP" \
  STRENGTH_NOW="$TODAY" \
  "$SCORE_SH" decay "$T6_DIR/test-lesson.md"
)

# With last_decayed = TODAY, days elapsed = 0, so strength should stay ~0.5 (0.5 * 0.5^0 = 0.5)
if awk -v s="$s_today_anchor" 'BEGIN { exit (s >= 0.4999 && s <= 0.5001 ? 0 : 1) }'; then
  pass "decay with last_decayed=today yields ~unchanged strength (0 days elapsed)"
else
  fail "decay with last_decayed=today yields ~unchanged strength (0 days elapsed)" \
    "got $s_today_anchor expected ~0.5"
fi

# ---- summary ------------------------------------------------------------------

echo ""
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo "First failure: $FIRST_FAIL"
  exit 1
fi
exit 0
