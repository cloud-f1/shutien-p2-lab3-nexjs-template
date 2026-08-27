#!/usr/bin/env bash
# E363 — check-promotion-staleness.sh fixtures.
#
# Part 1 uses the REAL 2026-07-13 proposal that sat unapplied for 6 weeks
# (docs/context/promotion-proposals/20260713-005943.md) as the fixture named
# in the epic's AC #1, replayed in an isolated temp dir so the real repo
# state is never touched.
#
# Part 2 exercises the Tier 0 registry-drift check against a synthetic
# fixture dir (never against the real ~/.claude/template-memory).
#
# All operations run in temp dirs. The real repo's promotion-proposals/,
# .last-promote-ts, and ~/.claude/template-memory are NEVER touched.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SUT="$REPO_ROOT/scripts/memory/check-promotion-staleness.sh"
FIXTURE="$REPO_ROOT/docs/context/promotion-proposals/20260713-005943.md"

[ -x "$SUT" ] || chmod +x "$SUT" 2>/dev/null || true

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

FAIL=0
assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" != "$actual" ]; then
    echo "FAIL: $desc (expected=$expected actual=$actual)"
    FAIL=1
  else
    echo "ok: $desc"
  fi
}

# ---- Part 1: staleness — real fixture, red then green ----------------------

[ -f "$FIXTURE" ] || { echo "FAIL: fixture not found: $FIXTURE"; exit 1; }

mkdir -p "$TMP/proposals"
cp "$FIXTURE" "$TMP/proposals/"

# Watermark = the moment auto-promote-check.sh created this exact proposal
# (2026-07-13 00:59:43 UTC, a few seconds before its own watermark stamp —
# see check-promotion-staleness.sh header for why watermark_epoch >= file
# epoch always holds at creation time).
WM_EPOCH=$(date -u -j -f "%Y-%m-%d %H:%M:%S" "2026-07-13 00:59:50" +%s 2>/dev/null \
  || date -u -d "2026-07-13 00:59:50" +%s)
echo "$WM_EPOCH" > "$TMP/watermark"

# RED: real "now" (today) is far more than 14 days past 2026-07-13 — the
# watermark has never moved since, exactly reproducing the real incident.
out=$(PROMOTION_PROPOSALS_DIR="$TMP/proposals" PROMOTION_WATERMARK_FILE="$TMP/watermark" \
  bash "$SUT" --staleness-only 2>&1)
rc=$?
echo "--- RED output ---"
echo "$out"
assert_eq "red: nonzero exit on stale watermark" "1" "$rc"
case "$out" in
  *"STALE"*"20260713-005943.md"*) echo "ok: red mentions the fixture file" ;;
  *) echo "FAIL: red output doesn't name the fixture file"; FAIL=1 ;;
esac

# GREEN: advance the watermark to "now" (simulating /athena:promote --apply,
# or a fresh auto-promote-check.sh run) — same proposal file still present.
date -u +%s > "$TMP/watermark"
out=$(PROMOTION_PROPOSALS_DIR="$TMP/proposals" PROMOTION_WATERMARK_FILE="$TMP/watermark" \
  bash "$SUT" --staleness-only 2>&1)
rc=$?
echo "--- GREEN output ---"
echo "$out"
assert_eq "green: zero exit once watermark is fresh" "0" "$rc"

# Deterministic variant using STALENESS_NOW_EPOCH instead of real time, to
# pin the exact boundary (14 vs 15 days).
WM2=$(date -u -j -f "%Y-%m-%d %H:%M:%S" "2026-01-01 00:00:00" +%s 2>/dev/null \
  || date -u -d "2026-01-01 00:00:00" +%s)
echo "$WM2" > "$TMP/watermark2"
NOW_14D=$(( WM2 + 14*86400 ))
NOW_15D=$(( WM2 + 15*86400 + 1 ))
out=$(PROMOTION_PROPOSALS_DIR="$TMP/proposals" PROMOTION_WATERMARK_FILE="$TMP/watermark2" \
  STALENESS_NOW_EPOCH="$NOW_14D" bash "$SUT" --staleness-only --days 14 2>&1)
assert_eq "boundary: exactly 14d old is NOT stale" "0" "$?"
out=$(PROMOTION_PROPOSALS_DIR="$TMP/proposals" PROMOTION_WATERMARK_FILE="$TMP/watermark2" \
  STALENESS_NOW_EPOCH="$NOW_15D" bash "$SUT" --staleness-only --days 14 2>&1)
assert_eq "boundary: 15d+1s old IS stale" "1" "$?"

# ---- Part 2: registry drift -------------------------------------------------

mkdir -p "$TMP/tier0"
: > "$TMP/tier0/anti-patterns.md"
: > "$TMP/tier0/dx-patterns.md"

cat > "$TMP/lesson-tags.json" <<'JSON'
{"defaults": {"anti-patterns.md": {}, "dx-patterns.md": {}}}
JSON

cat > "$TMP/half-life-defaults-missing.json" <<'JSON'
{"defaults": {"anti-patterns.md": 365}}
JSON

cat > "$TMP/half-life-defaults-complete.json" <<'JSON'
{"defaults": {"anti-patterns.md": 365, "dx-patterns.md": 180}}
JSON

out=$(TEMPLATE_MEMORY_DIR="$TMP/tier0" LESSON_TAGS_JSON="$TMP/lesson-tags.json" \
  HALF_LIFE_DEFAULTS_JSON="$TMP/half-life-defaults-missing.json" \
  bash "$SUT" --registry-only 2>&1)
rc=$?
echo "--- registry RED output ---"
echo "$out"
assert_eq "registry: nonzero exit when a disk file is unregistered" "2" "$rc"
case "$out" in
  *"dx-patterns.md"*) echo "ok: registry red names dx-patterns.md" ;;
  *) echo "FAIL: registry red output doesn't name dx-patterns.md"; FAIL=1 ;;
esac

out=$(TEMPLATE_MEMORY_DIR="$TMP/tier0" LESSON_TAGS_JSON="$TMP/lesson-tags.json" \
  HALF_LIFE_DEFAULTS_JSON="$TMP/half-life-defaults-complete.json" \
  bash "$SUT" --registry-only 2>&1)
rc=$?
echo "--- registry GREEN output ---"
echo "$out"
assert_eq "registry: zero exit once fully registered" "0" "$rc"

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "ALL PASS"
  exit 0
else
  echo "SOME TESTS FAILED"
  exit 1
fi
