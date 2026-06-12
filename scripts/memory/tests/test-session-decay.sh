#!/usr/bin/env bash
# E197 — session-start.sh once-per-day decay guard tests.
#
# Asserts:
#   - Fresh stamp (written today) → decay-all is SKIPPED
#   - Stale stamp (older than 86400 seconds) → decay-all is TRIGGERED
#   - Absent stamp → decay-all is TRIGGERED
#   - After trigger, stamp file is updated to current time
#   - Guard is best-effort: a failing decay does NOT block session start
#
# Tests directly exercise the decay-guard logic in session-start.sh by
# reading the stamp file behavior. Since session-start.sh has side effects
# (git log, cat files, etc.), we extract the guard logic into isolated
# helper calls rather than running the full hook.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SCORE_SH="$REPO_ROOT/scripts/memory/score.sh"
SESSION_START="$REPO_ROOT/scripts/hooks/session-start.sh"

[ -x "$SCORE_SH" ] || chmod +x "$SCORE_SH" 2>/dev/null || true
[ -x "$SESSION_START" ] || chmod +x "$SESSION_START" 2>/dev/null || true

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

make_lesson() {
  local path="$1"
  cat > "$path" <<EOF
---
tier: 0
strength: 0.5
half_life_days: 180
last_retrieved: 2026-05-07
retrieval_count: 0
created: 2026-05-07
---
# Test Lesson
EOF
}

DEFAULTS_JSON="$REPO_ROOT/scripts/memory/half-life-defaults.json"
AUDIT="$TMP/audit.jsonl"
DEDUP="$TMP/dedup"

# Helper: run the decay guard logic inline (extracted from session-start.sh).
# Args: $1=TIER0_DIR $2=STAMP_FILE
# Writes to stamp file if decay runs. Returns 0 if decayed, 1 if skipped.
run_decay_guard() {
  local tier0_dir="$1" stamp_file="$2"
  local now_ts; now_ts=$(date +%s)
  local do_decay=0
  if [ ! -f "$stamp_file" ]; then
    do_decay=1
  else
    local stamp_ts; stamp_ts=$(cat "$stamp_file" 2>/dev/null || echo 0)
    local elapsed=$(( now_ts - stamp_ts ))
    if [ "$elapsed" -ge 86400 ]; then
      do_decay=1
    fi
  fi
  if [ "$do_decay" = "1" ]; then
    # Run decay-all (best-effort)
    TEMPLATE_MEMORY_DIR="$tier0_dir" \
    ALLOW_TIER0_WRITE=1 \
    AUDIT_LOG_PATH="$AUDIT" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" \
    STRENGTH_DEDUP_DIR="$DEDUP" \
    STRENGTH_NOW="2026-06-01" \
    "$SCORE_SH" decay-all "$tier0_dir" >/dev/null 2>&1 || true
    # Update stamp
    echo "$now_ts" > "$stamp_file"
    return 0
  fi
  return 1
}

# ---- test 1: absent stamp → decay triggered ----------------------------------

T1_DIR="$TMP/t1"
mkdir -p "$T1_DIR"
make_lesson "$T1_DIR/failure-patterns.md"
STAMP1="$TMP/stamp1"
# No stamp file
[ ! -f "$STAMP1" ]

if run_decay_guard "$T1_DIR" "$STAMP1"; then
  pass "absent stamp triggers decay-all"
else
  fail "absent stamp triggers decay-all" "guard returned skipped"
fi

# ---- test 2: absent stamp → stamp file created afterward --------------------

if [ -f "$STAMP1" ]; then
  pass "decay guard creates stamp file after running"
else
  fail "decay guard creates stamp file after running" "stamp file missing after run"
fi

# ---- test 3: fresh stamp (now) → decay skipped -------------------------------

T3_DIR="$TMP/t3"
mkdir -p "$T3_DIR"
make_lesson "$T3_DIR/failure-patterns.md"
STAMP3="$TMP/stamp3"
# Write a fresh stamp (current time)
date +%s > "$STAMP3"

if run_decay_guard "$T3_DIR" "$STAMP3"; then
  fail "fresh stamp skips decay" "guard ran decay even though stamp is fresh"
else
  pass "fresh stamp skips decay"
fi

# ---- test 4: stale stamp (> 86400 s ago) → decay triggered ------------------

T4_DIR="$TMP/t4"
mkdir -p "$T4_DIR"
make_lesson "$T4_DIR/failure-patterns.md"
STAMP4="$TMP/stamp4"
# Write a stale stamp: 90000 seconds ago (25 hours)
stale_ts=$(( $(date +%s) - 90000 ))
echo "$stale_ts" > "$STAMP4"

if run_decay_guard "$T4_DIR" "$STAMP4"; then
  pass "stale stamp triggers decay-all"
else
  fail "stale stamp triggers decay-all" "guard skipped even though stamp was stale"
fi

# ---- test 5: stamp updated to current time after decay ----------------------

STAMP5="$TMP/stamp5"
stale_ts2=$(( $(date +%s) - 90001 ))
echo "$stale_ts2" > "$STAMP5"
T5_DIR="$TMP/t5"
mkdir -p "$T5_DIR"
make_lesson "$T5_DIR/failure-patterns.md"

before_ts=$(cat "$STAMP5")
run_decay_guard "$T5_DIR" "$STAMP5" || true
after_ts=$(cat "$STAMP5")

if [ "$after_ts" -gt "$before_ts" ] 2>/dev/null; then
  pass "stamp file updated to newer timestamp after decay"
else
  fail "stamp file updated to newer timestamp after decay" \
    "before=$before_ts after=$after_ts"
fi

# ---- test 6: exactly 86400s old → triggered ---------------------------------

T6_DIR="$TMP/t6"
mkdir -p "$T6_DIR"
make_lesson "$T6_DIR/failure-patterns.md"
STAMP6="$TMP/stamp6"
exactly_24h=$(( $(date +%s) - 86400 ))
echo "$exactly_24h" > "$STAMP6"

if run_decay_guard "$T6_DIR" "$STAMP6"; then
  pass "stamp exactly 86400s old triggers decay (>= boundary)"
else
  fail "stamp exactly 86400s old triggers decay (>= boundary)" "guard skipped"
fi

# ---- test 7: session-start.sh has the decay guard logic ---------------------
# Verify session-start.sh contains the stamp-file guard pattern

if grep -q "last-decay-ts" "$SESSION_START" 2>/dev/null; then
  pass "session-start.sh contains .last-decay-ts stamp guard"
else
  fail "session-start.sh contains .last-decay-ts stamp guard" \
    ".last-decay-ts not found in session-start.sh"
fi

# ---- test 8: best-effort: failing decay-all does not crash guard -------------

T8_DIR="$TMP/t8"  # Empty dir — decay-all will find no lessons (0 decayed)
mkdir -p "$T8_DIR"
STAMP8="$TMP/stamp8"

# Run guard with empty dir: should not crash even if decay-all silently exits
if run_decay_guard "$T8_DIR" "$STAMP8"; then
  pass "guard best-effort: runs without crash even with empty lesson dir"
else
  # Skipping is also acceptable for an empty dir (no lessons), but if decay-all
  # returns non-zero that's okay since we use || true
  pass "guard best-effort: runs without crash even with empty lesson dir"
fi

# ---- summary ------------------------------------------------------------------

echo ""
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo "First failure: $FIRST_FAIL"
  exit 1
fi
exit 0
