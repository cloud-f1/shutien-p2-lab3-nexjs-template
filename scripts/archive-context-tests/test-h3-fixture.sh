#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# test-h3-fixture.sh — fixture test for H3-structured archive-context.sh support
#
# Creates an H3-structured mock file (like orchestration-log.md) that uses
# ### headings as entry headings instead of ## headings, and asserts that
# archive-context.sh correctly detects and archives it when H3 entry count
# exceeds the configured LIMIT_VALUES threshold.
#
# Also verifies that the existing H2 behavior is unchanged.
#
# Exit 0 = all pass; exit 1 = at least one failure.
# -----------------------------------------------------------------------------
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE="$SCRIPT_DIR/../archive-context.sh"

if [ ! -x "$ARCHIVE" ]; then
  echo "FAIL: archive-context.sh not executable at $ARCHIVE" >&2
  exit 1
fi

PASS=0
FAIL=0

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() {
  echo "FAIL: $1"
  echo "  detail: $2"
  FAIL=$((FAIL + 1))
}

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Build a fake docs/context/ tree under TMP
mkdir -p "$TMP/docs/context/archive"
mkdir -p "$TMP/.claude"

# --- TEST SCENARIO A: H3-structured file exceeds limit ---
# orchestration-log.md uses H3 headings (###) under a top-level H2 header.
# Its limit is 50 H3 entries. We'll create a test file with limit=3 and 5 entries.
# We configure this via an override mechanism in archive-context.sh.

H3_FILE="$TMP/docs/context/orchestration-log.md"
cat > "$H3_FILE" << 'EOF'
# Orchestration Log

## Active Sessions

### Session 2026-01-01 Wave 1
Some content here.

### Session 2026-01-02 Wave 2
Some content here.

### Session 2026-01-03 Wave 3
Some content here.

### Session 2026-01-04 Wave 4
Some content here.

### Session 2026-01-05 Wave 5
Some content here.
EOF

# Run archive-context with H3 mode for orchestration-log.md
# limit=3 means 5 > 3, should archive
set +e
ARCHIVE_ROOT="$TMP/docs/context" \
ARCHIVE_AUDIT_LOG="$TMP/.claude/audit.jsonl" \
ARCHIVE_H3_FILES="orchestration-log.md" \
ARCHIVE_TEST_LIMITS="orchestration-log.md:3" \
  bash "$ARCHIVE" --auto 2>/dev/null
EXIT_CODE=$?
set -e

# The archive should have run (exit 0 in --auto mode)
if [ "$EXIT_CODE" -eq 0 ]; then
  pass "archive-context exits 0 in --auto mode even with H3 file"
else
  fail "archive-context exits 0 in --auto mode" "exit code: $EXIT_CODE"
fi

# Check that entries were archived (archive file should exist and have content)
ARCHIVE_FILE="$TMP/docs/context/archive"
if ls "$ARCHIVE_FILE"/*.md 2>/dev/null | head -1 | grep -q '.md'; then
  pass "archive file created for H3-structured file"
else
  fail "archive file created for H3-structured file" "no .md file in $ARCHIVE_FILE/"
fi

# The live orchestration-log.md should have fewer H3 entries now (at most 3)
if [ -f "$H3_FILE" ]; then
  remaining=$(grep -c '^### ' "$H3_FILE" 2>/dev/null || true)
  if [ "${remaining:-99}" -le 3 ]; then
    pass "H3 file trimmed to at most 3 entries (got: $remaining)"
  else
    fail "H3 file trimmed to at most 3 entries" "still has $remaining entries"
  fi
else
  fail "H3 file still exists after archival" "file missing"
fi

# --- TEST SCENARIO B: H2-structured file — existing behavior unchanged ---
H2_FILE="$TMP/docs/context/debug-log.md"
cat > "$H2_FILE" << 'EOF'
# Debug Log

## Session 2026-01-01
Debug entry 1.

## Session 2026-01-02
Debug entry 2.

## Session 2026-01-03
Debug entry 3.

## Session 2026-01-04
Debug entry 4.
EOF

# Create a fresh archive dir
rm -rf "$TMP/docs/context/archive"
mkdir -p "$TMP/docs/context/archive"

set +e
ARCHIVE_ROOT="$TMP/docs/context" \
ARCHIVE_AUDIT_LOG="$TMP/.claude/audit2.jsonl" \
ARCHIVE_TEST_LIMITS="debug-log.md:2" \
  bash "$ARCHIVE" --auto 2>/dev/null
EXIT_CODE2=$?
set -e

if [ "$EXIT_CODE2" -eq 0 ]; then
  pass "H2 file: archive-context exits 0 in --auto mode"
else
  fail "H2 file: archive-context exits 0 in --auto mode" "exit code: $EXIT_CODE2"
fi

if [ -f "$H2_FILE" ]; then
  remaining=$(grep -c '^## ' "$H2_FILE" 2>/dev/null || true)
  if [ "${remaining:-99}" -le 2 ]; then
    pass "H2 file trimmed to at most 2 entries (got: $remaining)"
  else
    fail "H2 file trimmed to at most 2 entries" "still has $remaining entries"
  fi
else
  fail "H2 file still exists after archival" "file missing"
fi

# --- TEST SCENARIO C: --check mode detects H3 over-limit ---
# Entry headings must carry a 20YY-MM date: undated sections are reference
# blocks by contract (never counted, never archived), in both entry orders.
H3_FILE2="$TMP/docs/context/orchestration-log.md"
cat > "$H3_FILE2" << 'EOF'
# Orchestration Log

## Active Sessions

### Session A — 2026-02-01
Content.

### Session B — 2026-02-02
Content.

### Session C — 2026-02-03
Content.

### Session D — 2026-02-04
Content.
EOF

set +e
ARCHIVE_ROOT="$TMP/docs/context" \
ARCHIVE_AUDIT_LOG="$TMP/.claude/audit3.jsonl" \
ARCHIVE_H3_FILES="orchestration-log.md" \
ARCHIVE_TEST_LIMITS="orchestration-log.md:2" \
  bash "$ARCHIVE" --check 2>/dev/null
EXIT_CODE3=$?
set -e

if [ "$EXIT_CODE3" -ne 0 ]; then
  pass "--check mode exits non-zero for H3 file over limit"
else
  fail "--check mode exits non-zero for H3 file over limit" "exit code: $EXIT_CODE3 (expected != 0)"
fi

# --- Summary ---
echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
