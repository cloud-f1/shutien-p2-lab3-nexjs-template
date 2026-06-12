#!/usr/bin/env bash
# E189 — brainstorm-retrieve.sh fixture tests.
#
# Covers acceptance criteria:
#   t1: no-match → output []  (lesson tags don't overlap with keywords)
#   t2: single-match → JSON array with 1 entry + audit event emitted
#   t3: multi-match-ranked → 3 lessons with different scores → ranked desc, top-5 limit
#   t4: evergreen-floor → lesson with evergreen:true but strength < 0.4 → still included
#   t5: strength-cutoff → lesson with score >= 1.0 but strength < 0.4 and no evergreen → excluded
#
# Tests run in isolated temp directories; the real ~/.claude/template-memory
# and the repo's audit.jsonl are NEVER touched.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/memory/brainstorm-retrieve.sh"
SCORE_SH="$REPO_ROOT/scripts/memory/score.sh"

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

# Build a lesson file with given tags (space-separated), optional strength, optional evergreen.
# Args: <path> <tags-space-sep> <strength> <evergreen:true|false|"">
make_lesson() {
  local path="$1" tags="$2" strength="${3:-0.6}" evergreen="${4:-}"
  local tags_yaml=""
  if [ -n "$tags" ]; then
    tags_yaml="tags: [$(echo "$tags" | tr ' ' ',')]"
  fi
  local evergreen_yaml=""
  if [ "$evergreen" = "true" ]; then
    evergreen_yaml="evergreen: true"
  fi
  cat > "$path" <<EOF
---
${tags_yaml}
tier: 0
half_life_days: 180
strength: ${strength}
last_retrieved: 2026-01-01T00:00:00Z
retrieval_count: 1
created: 2026-01-01T00:00:00Z
${evergreen_yaml}
---
# $(basename "$path" .md)

This lesson contains useful content about the topic.
EOF
}

# ---- t1: no-match → output [] -----------------------------------------------
t1_no_match() {
  local dir; dir=$(mktemp -d -p "$TMP" t1.XXXXXX)
  local audit="$dir/audit.jsonl"

  make_lesson "$dir/security.md" "auth jwt token security" "0.7"

  local out
  out=$(TEMPLATE_MEMORY_DIR="$dir" \
        AUDIT_LOG_PATH="$audit" \
        BRAINSTORM_TOP_N=5 \
        BRAINSTORM_MIN_SCORE=1.0 \
        BRAINSTORM_MIN_STRENGTH=0.4 \
        CLOCK_TS="2026-05-19T12:00:00Z" \
        EPIC="E189" \
        "$SCRIPT" "payment,billing,invoice" 2>/dev/null)

  if [ "$out" = "[]" ]; then
    pass "t1: no-match → output []"
  else
    fail "t1: no-match" "expected '[]', got: $out"
  fi

  # No audit events should have been emitted
  if [ -f "$audit" ] && [ -s "$audit" ]; then
    fail "t1: no audit events" "audit.jsonl is non-empty: $(cat "$audit")"
  else
    pass "t1: no-match → no audit events emitted"
  fi
}

# ---- t2: single-match → JSON array with 1 entry + audit event ---------------
t2_single_match() {
  local dir; dir=$(mktemp -d -p "$TMP" t2.XXXXXX)
  local audit="$dir/audit.jsonl"

  # A lesson with tags that match the keywords
  make_lesson "$dir/email-patterns.md" "email digest weekly notification" "0.65"

  local out
  out=$(TEMPLATE_MEMORY_DIR="$dir" \
        AUDIT_LOG_PATH="$audit" \
        BRAINSTORM_TOP_N=5 \
        BRAINSTORM_MIN_SCORE=1.0 \
        BRAINSTORM_MIN_STRENGTH=0.4 \
        CLOCK_TS="2026-05-19T12:00:00Z" \
        EPIC="E189" \
        "$SCRIPT" "digest,email,weekly,owners" 2>/dev/null)

  # Should be valid JSON
  if ! echo "$out" | python3 -c "import sys,json; json.load(sys.stdin)" >/dev/null 2>&1; then
    fail "t2: single-match json valid" "not valid JSON: $out"
    return
  fi

  local count
  count=$(echo "$out" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")

  if [ "$count" = "1" ]; then
    pass "t2: single-match → JSON array with 1 entry"
  else
    fail "t2: single-match count" "expected 1 entry, got $count; out=$out"
  fi

  # Check the entry has required fields
  local name
  name=$(echo "$out" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['name'])" 2>/dev/null || echo "")
  if [ "$name" = "email-patterns.md" ]; then
    pass "t2: single-match → entry.name is correct"
  else
    fail "t2: single-match name" "expected 'email-patterns.md', got: $name"
  fi

  # Audit event should have been emitted with context=brainstorm
  if [ ! -f "$audit" ] || [ ! -s "$audit" ]; then
    fail "t2: audit event" "audit.jsonl is empty or missing"
    return
  fi

  local event_context
  event_context=$(jq -r 'select(.event=="tier0_loaded") | .context' "$audit" 2>/dev/null || echo "")
  if [ "$event_context" = "brainstorm" ]; then
    pass "t2: single-match → audit event has context=brainstorm"
  else
    fail "t2: audit event context" "expected 'brainstorm', got: $event_context; audit=$(cat "$audit")"
  fi

  local event_agent
  event_agent=$(jq -r 'select(.event=="tier0_loaded") | .agent' "$audit" 2>/dev/null || echo "")
  if [ "$event_agent" = "strategist" ]; then
    pass "t2: single-match → audit event has agent=strategist"
  else
    fail "t2: audit event agent" "expected 'strategist', got: $event_agent"
  fi
}

# ---- t3: multi-match-ranked → 3 lessons scored differently, top-5 limit -----
t3_multi_match_ranked() {
  local dir; dir=$(mktemp -d -p "$TMP" t3.XXXXXX)
  local audit="$dir/audit.jsonl"

  # 3 lessons with different tag overlap with keywords "digest email weekly owners"
  # lesson-a: 3 matching tags (highest overlap)
  make_lesson "$dir/lesson-a.md" "digest email weekly summary notification owners" "0.7"
  # lesson-b: 2 matching tags
  make_lesson "$dir/lesson-b.md" "email notification alert owners" "0.5"
  # lesson-c: 1 matching tag
  make_lesson "$dir/lesson-c.md" "digest scheduling batch" "0.6"

  local out
  out=$(TEMPLATE_MEMORY_DIR="$dir" \
        AUDIT_LOG_PATH="$audit" \
        BRAINSTORM_TOP_N=5 \
        BRAINSTORM_MIN_SCORE=1.0 \
        BRAINSTORM_MIN_STRENGTH=0.4 \
        CLOCK_TS="2026-05-19T12:00:00Z" \
        EPIC="E189" \
        "$SCRIPT" "digest,email,weekly,owners" 2>/dev/null)

  if ! echo "$out" | python3 -c "import sys,json; json.load(sys.stdin)" >/dev/null 2>&1; then
    fail "t3: multi-match json valid" "not valid JSON: $out"
    return
  fi

  local count
  count=$(echo "$out" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
  if [ "$count" -ge 2 ]; then
    pass "t3: multi-match-ranked → at least 2 entries returned"
  else
    fail "t3: multi-match count" "expected >= 2, got $count; out=$out"
  fi

  # First entry should have higher score than second
  local score_ok
  score_ok=$(echo "$out" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if len(d) >= 2:
    print('ok' if float(d[0]['score']) >= float(d[1]['score']) else 'fail')
else:
    print('ok')  # only 1 item, trivially sorted
" 2>/dev/null || echo "fail")

  if [ "$score_ok" = "ok" ]; then
    pass "t3: multi-match-ranked → results ordered by score descending"
  else
    fail "t3: multi-match order" "results not ordered by score; out=$out"
  fi

  # Top N limit: test with TOP_N=2 → only 2 entries even if 3 match
  local out2
  out2=$(TEMPLATE_MEMORY_DIR="$dir" \
         AUDIT_LOG_PATH="$dir/audit2.jsonl" \
         BRAINSTORM_TOP_N=2 \
         BRAINSTORM_MIN_SCORE=1.0 \
         BRAINSTORM_MIN_STRENGTH=0.4 \
         CLOCK_TS="2026-05-19T12:00:00Z" \
         EPIC="E189" \
         "$SCRIPT" "digest,email,weekly,owners" 2>/dev/null)

  local count2
  count2=$(echo "$out2" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "-1")
  if [ "$count2" -le 2 ]; then
    pass "t3: multi-match TOP_N=2 → at most 2 entries"
  else
    fail "t3: multi-match TOP_N limit" "expected <= 2, got $count2; out=$out2"
  fi
}

# ---- t4: evergreen-floor → evergreen:true bypasses min-strength ---------------
t4_evergreen_floor() {
  local dir; dir=$(mktemp -d -p "$TMP" t4.XXXXXX)
  local audit="$dir/audit.jsonl"

  # Lesson with matching tags, strength < 0.4, but evergreen=true
  make_lesson "$dir/anti-patterns.md" "digest email weekly" "0.2" "true"

  local out
  out=$(TEMPLATE_MEMORY_DIR="$dir" \
        AUDIT_LOG_PATH="$audit" \
        BRAINSTORM_TOP_N=5 \
        BRAINSTORM_MIN_SCORE=1.0 \
        BRAINSTORM_MIN_STRENGTH=0.4 \
        CLOCK_TS="2026-05-19T12:00:00Z" \
        EPIC="E189" \
        "$SCRIPT" "digest,email,weekly" 2>/dev/null)

  if ! echo "$out" | python3 -c "import sys,json; json.load(sys.stdin)" >/dev/null 2>&1; then
    fail "t4: evergreen json valid" "not valid JSON: $out"
    return
  fi

  local count
  count=$(echo "$out" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
  if [ "$count" = "1" ]; then
    pass "t4: evergreen-floor → included despite strength=0.2 (evergreen bypasses min-strength)"
  else
    fail "t4: evergreen-floor" "expected 1 entry (evergreen bypass), got $count; out=$out"
  fi
}

# ---- t5: strength-cutoff → score>=1.0 but strength<0.4 and no evergreen → excluded ----
t5_strength_cutoff() {
  local dir; dir=$(mktemp -d -p "$TMP" t5.XXXXXX)
  local audit="$dir/audit.jsonl"

  # Lesson with matching tags, score will be >= 1.0, but low strength (0.2) and no evergreen
  make_lesson "$dir/weak-lesson.md" "digest email weekly owners" "0.2"

  local out
  out=$(TEMPLATE_MEMORY_DIR="$dir" \
        AUDIT_LOG_PATH="$audit" \
        BRAINSTORM_TOP_N=5 \
        BRAINSTORM_MIN_SCORE=1.0 \
        BRAINSTORM_MIN_STRENGTH=0.4 \
        CLOCK_TS="2026-05-19T12:00:00Z" \
        EPIC="E189" \
        "$SCRIPT" "digest,email,weekly,owners" 2>/dev/null)

  if [ "$out" = "[]" ]; then
    pass "t5: strength-cutoff → excluded (score>=1.0 but strength=0.2 < 0.4, no evergreen)"
  else
    fail "t5: strength-cutoff" "expected '[]', got: $out"
  fi
}

# ---- Run all tests -----------------------------------------------------------
t1_no_match
t2_single_match
t3_multi_match_ranked
t4_evergreen_floor
t5_strength_cutoff

echo ""
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo "First failure: $FIRST_FAIL"
  exit 1
fi
exit 0
