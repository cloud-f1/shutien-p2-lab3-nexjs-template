#!/bin/bash
# E185 fixture tests — half-life resolution + backfill idempotency.
#
# Covers acceptance criteria:
#   - score.sh resolution order works: frontmatter > JSON map > 180 default
#   - backfill is idempotent (running twice produces same frontmatter)
#   - lesson promoted into failure-patterns.md ends up with half_life_days: 30
#   - all 8 Tier 0 files get half_life_days after backfill
#
# Tests are isolated under a temp directory; they DO NOT touch the
# real ~/.claude/template-memory or the repo's checked-in defaults JSON
# (the JSON is read-only here).

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
RESOLVE="$REPO_ROOT/scripts/memory/half-life-resolve.sh"
BACKFILL="$REPO_ROOT/scripts/memory/backfill-half-life.sh"
DEFAULTS_JSON="$REPO_ROOT/scripts/memory/half-life-defaults.json"

PASS=0
FAIL=0

assert_eq() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  [PASS] $name"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $name — expected '$expected' got '$actual'"
    FAIL=$((FAIL + 1))
  fi
}

# ----- Resolver: frontmatter wins over JSON map -----

test_frontmatter_overrides_default() {
  local tmp; tmp=$(mktemp -d)
  cat > "$tmp/failure-patterns.md" <<'EOF'
---
half_life_days: 730
reason: pinned by hand — generational invariant
---
# Failure Patterns
EOF
  local got; got=$("$RESOLVE" "$tmp/failure-patterns.md")
  assert_eq "frontmatter overrides JSON map (730 not 30)" "730" "$got"
  rm -rf "$tmp"
}

# ----- Resolver: JSON map wins when no frontmatter -----

test_json_map_resolves_failure_patterns() {
  local tmp; tmp=$(mktemp -d)
  cat > "$tmp/failure-patterns.md" <<'EOF'
# Failure Patterns
no frontmatter here.
EOF
  local got; got=$("$RESOLVE" "$tmp/failure-patterns.md")
  assert_eq "no frontmatter -> JSON map gives 30 for failure-patterns.md" "30" "$got"
  rm -rf "$tmp"
}

test_json_map_resolves_anti_patterns() {
  local tmp; tmp=$(mktemp -d)
  cat > "$tmp/anti-patterns.md" <<'EOF'
# Anti-Patterns
no frontmatter.
EOF
  local got; got=$("$RESOLVE" "$tmp/anti-patterns.md")
  assert_eq "no frontmatter -> JSON map gives 365 for anti-patterns.md" "365" "$got"
  rm -rf "$tmp"
}

test_json_map_resolves_integration_gotchas() {
  local tmp; tmp=$(mktemp -d)
  cat > "$tmp/integration-gotchas.md" <<'EOF'
# Integration Gotchas
EOF
  local got; got=$("$RESOLVE" "$tmp/integration-gotchas.md")
  assert_eq "no frontmatter -> JSON map gives 90 for integration-gotchas.md" "90" "$got"
  rm -rf "$tmp"
}

# ----- Resolver: 180 fallback for unknown filename -----

test_unknown_file_falls_back_to_180() {
  local tmp; tmp=$(mktemp -d)
  cat > "$tmp/unknown-file.md" <<'EOF'
# Unknown File
not in the JSON map and no frontmatter.
EOF
  local got; got=$("$RESOLVE" "$tmp/unknown-file.md")
  assert_eq "unknown filename, no frontmatter -> 180 fallback" "180" "$got"
  rm -rf "$tmp"
}

# ----- Resolver: invalid frontmatter value falls through to JSON -----

test_invalid_frontmatter_falls_through() {
  local tmp; tmp=$(mktemp -d)
  cat > "$tmp/failure-patterns.md" <<'EOF'
---
half_life_days: forever
---
# Failure Patterns
EOF
  local got; got=$("$RESOLVE" "$tmp/failure-patterns.md")
  assert_eq "non-integer frontmatter -> falls through to JSON map (30)" "30" "$got"
  rm -rf "$tmp"
}

# ----- Backfill: covers all 8 Tier 0 files -----

test_backfill_covers_all_eight_files() {
  local tmp; tmp=$(mktemp -d)

  # Stub all 8 documented files with no frontmatter.
  for name in $(jq -r '.defaults | keys[]' "$DEFAULTS_JSON"); do
    cat > "$tmp/$name" <<EOF
# $name
no frontmatter.
EOF
  done

  HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" \
    "$BACKFILL" --dir "$tmp" >/dev/null

  # Each file must now resolve to its expected default.
  local fail_count=0
  for name in $(jq -r '.defaults | keys[]' "$DEFAULTS_JSON"); do
    local expected; expected=$(jq -r --arg n "$name" '.defaults[$n]' "$DEFAULTS_JSON")
    local got; got=$("$RESOLVE" "$tmp/$name")
    if [ "$expected" != "$got" ]; then
      echo "    -> $name: expected $expected got $got"
      fail_count=$((fail_count + 1))
    fi
  done
  assert_eq "all 8 Tier 0 files have correct half_life_days after backfill" "0" "$fail_count"
  rm -rf "$tmp"
}

# ----- Backfill: lesson in failure-patterns.md gets 30 -----

test_failure_patterns_promotion_gets_thirty() {
  local tmp; tmp=$(mktemp -d)
  cat > "$tmp/failure-patterns.md" <<'EOF'
# Failure Patterns

## failure-999: Some Newly Promoted Lesson
A specific bug + fix that we just promoted.
EOF
  HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" \
    "$BACKFILL" --dir "$tmp" >/dev/null

  local got; got=$("$RESOLVE" "$tmp/failure-patterns.md")
  assert_eq "lesson promoted into failure-patterns.md -> half_life_days: 30" "30" "$got"
  rm -rf "$tmp"
}

# ----- Backfill: idempotent -----

test_backfill_is_idempotent() {
  local tmp; tmp=$(mktemp -d)
  cat > "$tmp/anti-patterns.md" <<'EOF'
# Anti-Patterns
content here.
EOF
  HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" \
    "$BACKFILL" --dir "$tmp" >/dev/null
  local first_hash; first_hash=$(shasum "$tmp/anti-patterns.md" | awk '{print $1}')

  HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" \
    "$BACKFILL" --dir "$tmp" >/dev/null
  local second_hash; second_hash=$(shasum "$tmp/anti-patterns.md" | awk '{print $1}')

  assert_eq "backfill produces identical content on second run" "$first_hash" "$second_hash"
  rm -rf "$tmp"
}

# ----- Backfill: preserves existing frontmatter without the key -----

test_backfill_inserts_into_existing_frontmatter() {
  local tmp; tmp=$(mktemp -d)
  cat > "$tmp/anti-patterns.md" <<'EOF'
---
title: Anti-Patterns
owner: memory-curator
---
# Anti-Patterns
EOF
  HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" \
    "$BACKFILL" --dir "$tmp" >/dev/null

  local got; got=$("$RESOLVE" "$tmp/anti-patterns.md")
  assert_eq "backfill inserts key into existing frontmatter" "365" "$got"

  # Title should still be there.
  if grep -q '^title: Anti-Patterns$' "$tmp/anti-patterns.md"; then
    echo "  [PASS] backfill preserves pre-existing frontmatter keys"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] pre-existing frontmatter keys were dropped"
    FAIL=$((FAIL + 1))
  fi
  rm -rf "$tmp"
}

# ----- Backfill: leaves an explicit override alone -----

test_backfill_does_not_override_existing_value() {
  local tmp; tmp=$(mktemp -d)
  cat > "$tmp/failure-patterns.md" <<'EOF'
---
half_life_days: 730
reason: pinned manually
---
# Failure Patterns
EOF
  HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" \
    "$BACKFILL" --dir "$tmp" >/dev/null

  local got; got=$("$RESOLVE" "$tmp/failure-patterns.md")
  assert_eq "backfill respects manual override (still 730, not 30)" "730" "$got"
  rm -rf "$tmp"
}

# ----- Run them -----

echo "=== E185: half-life resolver + backfill ==="
test_frontmatter_overrides_default
test_json_map_resolves_failure_patterns
test_json_map_resolves_anti_patterns
test_json_map_resolves_integration_gotchas
test_unknown_file_falls_back_to_180
test_invalid_frontmatter_falls_through
test_backfill_covers_all_eight_files
test_failure_patterns_promotion_gets_thirty
test_backfill_is_idempotent
test_backfill_inserts_into_existing_frontmatter
test_backfill_does_not_override_existing_value

echo ""
echo "Passed: $PASS | Failed: $FAIL"
[ "$FAIL" = "0" ] || exit 1
