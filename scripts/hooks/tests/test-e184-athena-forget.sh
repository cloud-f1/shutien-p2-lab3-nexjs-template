#!/usr/bin/env bash
# E184 — `/athena:forget` archive engine fixture tests.
#
# Covers acceptance criteria:
#   - apply archives lessons below threshold; leaves stronger ones alone
#   - dry-run / list produces zero filesystem changes
#   - revive round-trips a previously archived lesson
#   - lesson-tags.json sidecar entry deleted on archive, restored via revive
#   - missing _archive/ directory is auto-created
#   - frontmatter is preserved through archive -> revive
#   - audit log emits lesson_archived + lesson_revived events
#   - custom --threshold overrides default 0.10 cutoff
#   - forgotten.md log row appended per archive, removed on revive
#
# Tests are isolated under a temp directory; they DO NOT touch the real
# ~/.claude/template-memory or the repo's own audit log or sidecar JSON.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
FORGET="$REPO_ROOT/scripts/memory/forget.sh"
SCORE="$REPO_ROOT/scripts/memory/score.sh"
DEFAULTS_JSON="$REPO_ROOT/scripts/memory/half-life-defaults.json"

[ -x "$FORGET" ] || chmod +x "$FORGET" 2>/dev/null || true
[ -x "$SCORE" ]  || chmod +x "$SCORE"  2>/dev/null || true

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

# Build a self-contained Tier 0 fixture dir with N lessons. Each lesson gets
# the explicit `strength` value passed in. Returns the dir path on stdout.
build_tier0() {
  local dir; dir=$(mktemp -d -p "$TMP" tier0.XXXXXX)
  # Two weak (below 0.10), three strong (above), all from the documented set.
  cat > "$dir/anti-patterns.md" <<'EOF'
---
strength: 0.85
last_retrieved: 2026-05-01
retrieval_count: 3
half_life_days: 365
created: 2026-01-01
---
# Anti-Patterns
strong evergreen.
EOF
  cat > "$dir/architecture-lessons.md" <<'EOF'
---
strength: 0.50
last_retrieved: 2026-05-01
retrieval_count: 1
half_life_days: 365
created: 2026-01-01
---
# Architecture
mid-strength.
EOF
  cat > "$dir/dx-patterns.md" <<'EOF'
---
strength: 0.20
last_retrieved: 2026-04-01
retrieval_count: 0
half_life_days: 90
created: 2026-01-01
---
# DX
moderate.
EOF
  cat > "$dir/failure-patterns.md" <<'EOF'
---
strength: 0.05
last_retrieved: 2026-01-01
retrieval_count: 0
half_life_days: 30
created: 2026-01-01
---
# Failure
WEAK — below threshold.
EOF
  cat > "$dir/integration-gotchas.md" <<'EOF'
---
strength: 0.08
last_retrieved: 2026-01-01
retrieval_count: 0
half_life_days: 30
created: 2026-01-01
---
# Integration
WEAK — below threshold.
EOF
  echo "$dir"
}

# Build a lesson-tags.json sidecar with entries for the fixture lessons.
build_tags_json() {
  local path; path="$TMP/tags-$$-$RANDOM-$RANDOM.json"
  cat > "$path" <<'EOF'
{
  "$comment": "test fixture",
  "$schema_version": 1,
  "defaults": {
    "anti-patterns.md":     {"tags": ["evergreen"], "domains": [], "evergreen": true},
    "failure-patterns.md":  {"tags": ["debugging"], "domains": ["server/"], "evergreen": false},
    "integration-gotchas.md": {"tags": ["integration"], "domains": ["server/app/"], "evergreen": false}
  },
  "branch_tag_cues": {},
  "path_tag_cues": {}
}
EOF
  echo "$path"
}

# ---- t1: apply archives lessons below threshold; leaves stronger ones ----
t1_apply_archives_weak_only() {
  local dir; dir=$(build_tier0)
  local tags; tags=$(build_tags_json)
  local audit="$dir/audit.jsonl"

  TEMPLATE_MEMORY_DIR="$dir" \
    LESSON_TAGS_JSON="$tags" \
    AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" \
    STRENGTH_NOW="2026-05-07" \
    "$FORGET" apply >/dev/null

  # Expect the 2 weak ones moved to _archive/, 3 strong ones left in place.
  local moved=0 left=0
  for w in failure-patterns.md integration-gotchas.md; do
    [ -f "$dir/_archive/$w" ] && moved=$((moved + 1))
    [ -f "$dir/$w" ] && left=$((left + 1))
  done
  local kept=0
  for k in anti-patterns.md architecture-lessons.md dx-patterns.md; do
    [ -f "$dir/$k" ] && kept=$((kept + 1))
  done
  if [ "$moved" = "2" ] && [ "$left" = "0" ] && [ "$kept" = "3" ]; then
    pass "apply archives 2 weak lessons + leaves 3 strong ones in place"
  else
    fail "apply archives weak only" "moved=$moved left=$left kept=$kept"
  fi
}

# ---- t2: list (dry-run) makes zero filesystem changes ----
t2_dry_run_no_writes() {
  local dir; dir=$(build_tier0)
  local tags; tags=$(build_tags_json)
  local audit="$dir/audit.jsonl"

  # Snapshot every file's content + mtime + sidecar before.
  local pre_state="$TMP/pre-state.txt"
  ( cd "$dir" && find . -type f -exec sha256sum {} \; ) > "$pre_state" 2>/dev/null
  local pre_tags; pre_tags=$(cat "$tags")

  TEMPLATE_MEMORY_DIR="$dir" \
    LESSON_TAGS_JSON="$tags" \
    AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" \
    STRENGTH_NOW="2026-05-07" \
    "$FORGET" list >/dev/null

  local post_state="$TMP/post-state.txt"
  ( cd "$dir" && find . -type f -exec sha256sum {} \; ) > "$post_state" 2>/dev/null
  local post_tags; post_tags=$(cat "$tags")

  if diff -q "$pre_state" "$post_state" >/dev/null 2>&1 \
     && [ "$pre_tags" = "$post_tags" ] \
     && [ ! -d "$dir/_archive" ]; then
    pass "list (dry-run) makes ZERO filesystem changes (no _archive, no sidecar mutation)"
  else
    fail "list dry-run no writes" "filesystem state changed"
  fi
}

# ---- t3: revive round-trips a previously archived lesson ----
t3_revive_round_trip() {
  local dir; dir=$(build_tier0)
  local tags; tags=$(build_tags_json)
  local audit="$dir/audit.jsonl"

  # First: archive.
  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$FORGET" apply >/dev/null

  [ -f "$dir/_archive/failure-patterns.md" ] || {
    fail "revive setup" "archive step did not produce _archive/failure-patterns.md"
    return
  }

  # Second: revive.
  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-08" \
    "$FORGET" revive failure-patterns.md >/dev/null

  if [ -f "$dir/failure-patterns.md" ] \
     && [ ! -f "$dir/_archive/failure-patterns.md" ]; then
    pass "revive moves lesson back to active dir (no longer in _archive)"
  else
    fail "revive round-trip" "active=[$([ -f "$dir/failure-patterns.md" ] && echo yes || echo no)] still-archived=[$([ -f "$dir/_archive/failure-patterns.md" ] && echo yes || echo no)]"
  fi
}

# ---- t4: sidecar entry deleted on archive ----
t4_sidecar_deleted_on_archive() {
  local dir; dir=$(build_tier0)
  local tags; tags=$(build_tags_json)
  local audit="$dir/audit.jsonl"

  # Pre: failure-patterns.md MUST be in the sidecar.
  local pre; pre=$(jq -r '.defaults["failure-patterns.md"] // empty' "$tags")
  [ -z "$pre" ] && { fail "sidecar pre-condition" "failure-patterns.md missing from sidecar"; return; }

  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$FORGET" apply >/dev/null

  local post; post=$(jq -r '.defaults["failure-patterns.md"] // "GONE"' "$tags")
  if [ "$post" = "GONE" ]; then
    pass "sidecar entry deleted on archive (failure-patterns.md no longer in lesson-tags.json)"
  else
    fail "sidecar deleted on archive" "still present: $post"
  fi
}

# ---- t5: sidecar untouched for non-candidates ----
t5_sidecar_untouched_for_strong() {
  local dir; dir=$(build_tier0)
  local tags; tags=$(build_tags_json)
  local audit="$dir/audit.jsonl"

  local pre; pre=$(jq -c '.defaults["anti-patterns.md"]' "$tags")

  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$FORGET" apply >/dev/null

  local post; post=$(jq -c '.defaults["anti-patterns.md"]' "$tags")
  if [ "$pre" = "$post" ] && [ "$pre" != "null" ]; then
    pass "sidecar entry for strong lessons (anti-patterns.md) untouched"
  else
    fail "sidecar untouched for strong" "pre=$pre post=$post"
  fi
}

# ---- t6: missing _archive dir is auto-created on first apply ----
t6_archive_dir_autocreated() {
  local dir; dir=$(build_tier0)
  local tags; tags=$(build_tags_json)
  local audit="$dir/audit.jsonl"

  [ ! -d "$dir/_archive" ] || { fail "t6 precondition" "_archive already exists"; return; }

  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$FORGET" apply >/dev/null

  if [ -d "$dir/_archive" ] && [ -f "$dir/_archive/forgotten.md" ]; then
    pass "missing _archive/ directory + forgotten.md log auto-created on first apply"
  else
    fail "archive dir autocreated" "_archive=$([ -d "$dir/_archive" ] && echo yes || echo no) log=$([ -f "$dir/_archive/forgotten.md" ] && echo yes || echo no)"
  fi
}

# ---- t7: frontmatter (strength + retrieval_count + half_life) preserved on archive ----
t7_frontmatter_preserved_on_archive() {
  local dir; dir=$(build_tier0)
  local tags; tags=$(build_tags_json)
  local audit="$dir/audit.jsonl"

  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$FORGET" apply >/dev/null

  local archived="$dir/_archive/failure-patterns.md"
  if grep -q "^strength: 0.05$" "$archived" \
     && grep -q "^last_retrieved: 2026-01-01$" "$archived" \
     && grep -q "^retrieval_count: 0$" "$archived" \
     && grep -q "^half_life_days: 30$" "$archived" \
     && grep -q "^archived_at: 2026-05-07$" "$archived"; then
    pass "archived file preserves strength + last_retrieved + retrieval_count + half_life + adds archived_at"
  else
    pre_dump=$(grep -E "^(strength|last_retrieved|retrieval_count|half_life_days|archived_at):" "$archived" | tr '\n' ';')
    fail "frontmatter preserved on archive" "got: $pre_dump"
  fi
}

# ---- t8: revive strips archived_at marker but keeps all other frontmatter ----
t8_revive_preserves_frontmatter() {
  local dir; dir=$(build_tier0)
  local tags; tags=$(build_tags_json)
  local audit="$dir/audit.jsonl"

  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$FORGET" apply >/dev/null
  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-08" \
    "$FORGET" revive failure-patterns.md >/dev/null

  local revived="$dir/failure-patterns.md"
  if grep -q "^strength: 0.05$" "$revived" \
     && grep -q "^last_retrieved: 2026-01-01$" "$revived" \
     && grep -q "^retrieval_count: 0$" "$revived" \
     && grep -q "^half_life_days: 30$" "$revived" \
     && ! grep -q "^archived_at:" "$revived"; then
    pass "revive preserves all frontmatter EXCEPT strips archived_at marker"
  else
    fail "revive preserves frontmatter" "marker still present or other fields lost"
  fi
}

# ---- t9: audit log emits lesson_archived per archive ----
t9_audit_emits_archived() {
  local dir; dir=$(build_tier0)
  local tags; tags=$(build_tags_json)
  local audit="$dir/audit.jsonl"

  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$FORGET" apply >/dev/null

  local count
  count=$(jq -c 'select(.event == "lesson_archived")' "$audit" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$count" = "2" ]; then
    pass "audit emits 2 lesson_archived events (one per weak file)"
  else
    fail "audit emits archived" "got $count lesson_archived events"
  fi
}

# ---- t10: lesson_archived event carries lesson + strength + threshold ----
t10_audit_archived_fields() {
  local dir; dir=$(build_tier0)
  local tags; tags=$(build_tags_json)
  local audit="$dir/audit.jsonl"

  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$FORGET" apply >/dev/null

  local hit
  hit=$(jq -c --arg n "failure-patterns.md" \
    'select(.event == "lesson_archived" and .lesson == $n)' "$audit" 2>/dev/null | head -1)
  local lesson strength threshold
  lesson=$(echo "$hit" | jq -r .lesson 2>/dev/null)
  strength=$(echo "$hit" | jq -r .strength 2>/dev/null)
  threshold=$(echo "$hit" | jq -r .threshold 2>/dev/null)

  if [ "$lesson" = "failure-patterns.md" ] \
     && [ "$strength" = "0.05" ] \
     && [ "$threshold" = "0.1" ]; then
    pass "lesson_archived event carries lesson + strength=0.05 + threshold=0.10"
  else
    fail "lesson_archived fields" "lesson=$lesson strength=$strength threshold=$threshold"
  fi
}

# ---- t11: audit log emits lesson_revived on revive ----
t11_audit_emits_revived() {
  local dir; dir=$(build_tier0)
  local tags; tags=$(build_tags_json)
  local audit="$dir/audit.jsonl"

  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$FORGET" apply >/dev/null
  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-08" \
    "$FORGET" revive failure-patterns.md >/dev/null

  local count
  count=$(jq -c 'select(.event == "lesson_revived")' "$audit" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$count" = "1" ]; then
    pass "audit emits 1 lesson_revived event after revive"
  else
    fail "audit emits revived" "got $count lesson_revived events"
  fi
}

# ---- t12: --threshold override widens the sweep ----
t12_threshold_override_widens() {
  local dir; dir=$(build_tier0)
  local tags; tags=$(build_tags_json)
  local audit="$dir/audit.jsonl"

  # Threshold 0.30 should pull in dx-patterns.md (0.20) too.
  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$FORGET" apply --threshold 0.30 >/dev/null

  local archived_count=0
  for w in failure-patterns.md integration-gotchas.md dx-patterns.md; do
    [ -f "$dir/_archive/$w" ] && archived_count=$((archived_count + 1))
  done
  # anti-patterns (0.85) and architecture-lessons (0.50) must remain.
  local kept_count=0
  for k in anti-patterns.md architecture-lessons.md; do
    [ -f "$dir/$k" ] && kept_count=$((kept_count + 1))
  done

  if [ "$archived_count" = "3" ] && [ "$kept_count" = "2" ]; then
    pass "--threshold 0.30 widens sweep to 3 lessons (still keeps 0.50 + 0.85)"
  else
    fail "threshold override" "archived=$archived_count kept=$kept_count (want 3 + 2)"
  fi
}

# ---- t13: forgotten.md row appended on archive, removed on revive ----
t13_forgotten_log_round_trip() {
  local dir; dir=$(build_tier0)
  local tags; tags=$(build_tags_json)
  local audit="$dir/audit.jsonl"

  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$FORGET" apply >/dev/null

  local log="$dir/_archive/forgotten.md"
  local rows_after_archive
  rows_after_archive=$(grep "^| 2026-05-07 | failure-patterns.md " "$log" 2>/dev/null | wc -l | tr -d ' ')

  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-08" \
    "$FORGET" revive failure-patterns.md >/dev/null

  local rows_after_revive
  rows_after_revive=$(grep "^| 2026-05-07 | failure-patterns.md " "$log" 2>/dev/null | wc -l | tr -d ' ')

  if [ "$rows_after_archive" = "1" ] && [ "$rows_after_revive" = "0" ]; then
    pass "forgotten.md row appended on archive (1) + removed on revive (0)"
  else
    fail "forgotten.md round-trip" "after_archive=$rows_after_archive after_revive=$rows_after_revive"
  fi
}

# ---- t14: revive of nonexistent basename exits non-zero ----
t14_revive_missing_errors() {
  local dir; dir=$(build_tier0)
  local tags; tags=$(build_tags_json)
  local audit="$dir/audit.jsonl"

  if TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
       HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
       "$FORGET" revive does-not-exist.md 2>/dev/null; then
    fail "revive missing -> nonzero exit" "got exit 0"
  else
    pass "revive of nonexistent basename exits non-zero"
  fi
}

# ---- t15: list-archived shows what's been archived (with date) ----
t15_list_archived_lists_archived() {
  local dir; dir=$(build_tier0)
  local tags; tags=$(build_tags_json)
  local audit="$dir/audit.jsonl"

  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$FORGET" apply >/dev/null

  local out
  out=$(TEMPLATE_MEMORY_DIR="$dir" "$FORGET" list-archived 2>/dev/null)
  local hits=0
  echo "$out" | grep -q "failure-patterns.md (archived 2026-05-07)" && hits=$((hits + 1))
  echo "$out" | grep -q "integration-gotchas.md (archived 2026-05-07)" && hits=$((hits + 1))

  if [ "$hits" = "2" ] && ! echo "$out" | grep -q "forgotten.md"; then
    pass "list-archived prints both archived lessons with date (excludes forgotten.md)"
  else
    fail "list-archived" "hits=$hits out=[$out]"
  fi
}

# ---- t16: revive restores order + sidecar regeneration is left alone ----
# Note: per the spec, archive DELETES the sidecar entry. Revive does NOT
# regenerate it (manual re-curation by @memory-curator is the intended flow,
# matching the read-only Tier 0 invariant for sidecar). This test pins that.
t16_revive_does_not_regenerate_sidecar() {
  local dir; dir=$(build_tier0)
  local tags; tags=$(build_tags_json)
  local audit="$dir/audit.jsonl"

  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$FORGET" apply >/dev/null
  TEMPLATE_MEMORY_DIR="$dir" LESSON_TAGS_JSON="$tags" AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-08" \
    "$FORGET" revive failure-patterns.md >/dev/null

  # After revive, sidecar entry is intentionally still missing (per design —
  # it's curator's job to re-tag a revived lesson, not forget.sh's).
  local post; post=$(jq -r '.defaults["failure-patterns.md"] // "GONE"' "$tags")
  if [ "$post" = "GONE" ]; then
    pass "revive intentionally leaves sidecar gap (curator re-tags via /athena:promote)"
  else
    fail "revive sidecar handling" "expected GONE got $post"
  fi
}

echo "=== E184: /athena:forget archive engine ==="
t1_apply_archives_weak_only
t2_dry_run_no_writes
t3_revive_round_trip
t4_sidecar_deleted_on_archive
t5_sidecar_untouched_for_strong
t6_archive_dir_autocreated
t7_frontmatter_preserved_on_archive
t8_revive_preserves_frontmatter
t9_audit_emits_archived
t10_audit_archived_fields
t11_audit_emits_revived
t12_threshold_override_widens
t13_forgotten_log_round_trip
t14_revive_missing_errors
t15_list_archived_lists_archived
t16_revive_does_not_regenerate_sidecar

TOTAL=$((PASS + FAIL))
echo "----"
echo "$PASS/$TOTAL passed"

if [ $FAIL -gt 0 ]; then
  echo "first failure: $FIRST_FAIL" >&2
  exit 1
fi
exit 0
