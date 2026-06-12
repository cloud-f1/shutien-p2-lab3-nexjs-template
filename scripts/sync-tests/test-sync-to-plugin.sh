#!/usr/bin/env bash
# test-sync-to-plugin.sh — Smoke tests for scripts/sync-to-plugin.sh
#
# Tests:
#   1. dry-run exits 0 on a clean tree (no unexpected output)
#   2. dry-run exits non-zero after a deliberate edit in a template command
#   3. --athena-core-path flag routes sync to a custom directory
#   4. audit event is emitted on dry-run invocation
#
# All tests use temp directories as the "athena-core" target —
# NO writes to /Users/MH/Documents/git_saas/athena-core or any real path.
# Runtime: <3s

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SYNC="$REPO_ROOT/scripts/sync-to-plugin.sh"

# Ensure the script is executable
[ -x "$SYNC" ] || chmod +x "$SYNC" 2>/dev/null || true

PASS=0
FAIL=0
FIRST_FAIL=""

pass() {
  echo "PASS: $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "FAIL: $1"
  echo "      $2"
  FAIL=$((FAIL + 1))
  if [ -z "$FIRST_FAIL" ]; then
    FIRST_FAIL="$1: $2"
  fi
}

# ─── Test 1: dry-run exits 0 on a clean tree ─────────────────────────────────
TEST_NAME="dry-run exits 0 on clean tree"

TMP1=$(mktemp -d)
trap 'rm -rf "$TMP1"' EXIT

# Mirror the real template asset dirs into the fake athena-core target
# so the dry-run sees no diff.
mkdir -p "$TMP1/agents" "$TMP1/commands/athena" "$TMP1/skills" \
         "$TMP1/hooks" "$TMP1/scripts/memory"

rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/.claude/agents/" "$TMP1/agents/" 2>/dev/null || true
rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/.claude/commands/athena/" "$TMP1/commands/athena/" 2>/dev/null || true
rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/.claude/skills/" "$TMP1/skills/" 2>/dev/null || true
rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/scripts/hooks/" "$TMP1/hooks/" 2>/dev/null || true
rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/scripts/memory/" "$TMP1/scripts/memory/" 2>/dev/null || true

if bash "$SYNC" --athena-core-path "$TMP1" > /dev/null 2>&1; then
  pass "$TEST_NAME"
else
  exit_code=$?
  # If diff was detected, print what differed for diagnosis
  output=$(bash "$SYNC" --athena-core-path "$TMP1" 2>&1 || true)
  fail "$TEST_NAME" "Expected exit 0, got $exit_code. Output: $(echo "$output" | head -5)"
fi

# ─── Test 2: dry-run exits non-zero after deliberate edit ─────────────────────
TEST_NAME="dry-run exits non-zero after deliberate edit in template command"

TMP2=$(mktemp -d)
trap 'rm -rf "$TMP2"' EXIT

# Mirror identical content again
mkdir -p "$TMP2/agents" "$TMP2/commands/athena" "$TMP2/skills" \
         "$TMP2/hooks" "$TMP2/scripts/memory"

rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/.claude/agents/" "$TMP2/agents/" 2>/dev/null || true
rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/.claude/commands/athena/" "$TMP2/commands/athena/" 2>/dev/null || true
rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/.claude/skills/" "$TMP2/skills/" 2>/dev/null || true
rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/scripts/hooks/" "$TMP2/hooks/" 2>/dev/null || true
rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/scripts/memory/" "$TMP2/scripts/memory/" 2>/dev/null || true

# Introduce a deliberate drift: overwrite one command in the TEMPLATE source
# by modifying a temp copy of it (we never modify the real template).
# Strategy: create a temp agent directory with one modified file as the
# "template source" — we do this by pointing to a patched copy.
# Simpler: just corrupt one target file so dry-run sees a diff.
TARGET_CMD="$TMP2/commands/athena/loop.md"
if [ -f "$TARGET_CMD" ]; then
  echo "# DRIFT TEST MARKER - deliberate modification" >> "$TARGET_CMD"
else
  # loop.md doesn't exist yet in target; create a dummy so diff fires
  mkdir -p "$TMP2/commands/athena"
  echo "# dummy stale content" > "$TARGET_CMD"
fi

if bash "$SYNC" --athena-core-path "$TMP2" > /dev/null 2>&1; then
  fail "$TEST_NAME" "Expected exit non-zero (diff detected), but got exit 0"
else
  pass "$TEST_NAME"
fi

# ─── Test 3: --athena-core-path routes to custom directory ────────────────────
TEST_NAME="--athena-core-path flag uses custom target dir"

TMP3=$(mktemp -d)
trap 'rm -rf "$TMP3"' EXIT

# Mirror identical content so we're testing routing, not diff
mkdir -p "$TMP3/agents" "$TMP3/commands/athena" "$TMP3/skills" \
         "$TMP3/hooks" "$TMP3/scripts/memory"

rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/.claude/agents/" "$TMP3/agents/" 2>/dev/null || true
rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/.claude/commands/athena/" "$TMP3/commands/athena/" 2>/dev/null || true
rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/.claude/skills/" "$TMP3/skills/" 2>/dev/null || true
rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/scripts/hooks/" "$TMP3/hooks/" 2>/dev/null || true
rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/scripts/memory/" "$TMP3/scripts/memory/" 2>/dev/null || true

output=$(bash "$SYNC" --athena-core-path "$TMP3" 2>&1)
exit_code=$?

# The output must reference TMP3 as the target, proving the flag was honored
if echo "$output" | grep -q "$TMP3"; then
  pass "$TEST_NAME"
else
  fail "$TEST_NAME" "Output did not reference custom path $TMP3. exit=$exit_code. Output: $(echo "$output" | head -3)"
fi

# ─── Test 4: audit event emitted on dry-run invocation ───────────────────────
TEST_NAME="audit event emitted on dry-run invocation"

TMP4=$(mktemp -d)
TMP_AUDIT=$(mktemp)
trap 'rm -rf "$TMP4"; rm -f "$TMP_AUDIT"' EXIT

mkdir -p "$TMP4/agents" "$TMP4/commands/athena" "$TMP4/skills" \
         "$TMP4/hooks" "$TMP4/scripts/memory"

rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/.claude/agents/" "$TMP4/agents/" 2>/dev/null || true
rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/.claude/commands/athena/" "$TMP4/commands/athena/" 2>/dev/null || true
rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/.claude/skills/" "$TMP4/skills/" 2>/dev/null || true
rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/scripts/hooks/" "$TMP4/hooks/" 2>/dev/null || true
rsync -rlc --exclude="*.pyc" --exclude="__pycache__" \
  "$REPO_ROOT/scripts/memory/" "$TMP4/scripts/memory/" 2>/dev/null || true

# Patch the sync script to use our temp audit log.
# We do this by creating a wrapper that sets AUDIT_LOG env-style.
# The sync script uses AUDIT_LOG variable internally — we patch via a subshell.
PATCHED=$(mktemp)
# Inject AUDIT_LOG override right after the variable declarations
sed "s|AUDIT_LOG=\"\${TEMPLATE_ROOT}/.claude/audit.jsonl\"|AUDIT_LOG=\"$TMP_AUDIT\"|" "$SYNC" > "$PATCHED"
chmod +x "$PATCHED"

bash "$PATCHED" --athena-core-path "$TMP4" > /dev/null 2>&1 || true
rm -f "$PATCHED"

if [ -f "$TMP_AUDIT" ] && grep -q '"event":"athena_sync"' "$TMP_AUDIT" 2>/dev/null; then
  pass "$TEST_NAME"
else
  fail "$TEST_NAME" "No athena_sync event found in audit log. Audit log contents: $(cat "$TMP_AUDIT" 2>/dev/null || echo '(empty)')"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  echo "First failure: $FIRST_FAIL"
  exit 1
fi

exit 0
