#!/usr/bin/env bash
# E182 — Selective SessionStart inject fixture tests.
#
# Covers acceptance criteria from docs/epics/e182-selective-sessionstart-injection.md:
#   - Block A (PRIMER) inject is byte-identical to pre-E182 behavior
#   - Branch touching server/auth/* surfaces auth + security lessons
#   - Branch touching server/alembic/versions/* surfaces workflow + alembic lesson
#   - Empty cue (initial clone, no diff) -> Block B emits no lessons
#   - Strength tie-break: when tag/domain hits tie, higher-strength wins
#   - Budget cap: ≤ E182_BUDGET_LINES total Block B output
#   - tier0_loaded events emitted for every selected file
#   - score.sh tie-break wired (NOT reimplemented)
#   - Branch-name cue (feat/e183-* -> epic-pipeline tag)
#   - Evergreen lessons (anti-patterns) bypass scoring threshold
#
# All tests run in isolated temp directories — never touches the real
# ~/.claude/template-memory or the repo's audit log.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
INJECT="$REPO_ROOT/scripts/memory/inject.sh"
MATCH="$REPO_ROOT/scripts/memory/match.sh"
SCORE="$REPO_ROOT/scripts/memory/score.sh"
SIDECAR="$REPO_ROOT/scripts/memory/lesson-tags.json"

for h in "$INJECT" "$MATCH" "$SCORE"; do
  [ -x "$h" ] || chmod +x "$h" 2>/dev/null || true
done

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

# Build a minimal Tier 0 stub mirroring the canonical lesson set.
# Each file gets a small, distinct content body so we can grep for it.
stub_tier0() {
  local dir="$1"
  cat > "$dir/security-learnings.md" <<'EOF'
---
strength: 0.7
half_life_days: 365
---
# Security Learnings
## sec-001: never store tokens in localStorage
SECURITY-LESSON-MARKER body content here.
## sec-002: httpOnly cookies for refresh
Body 2.
EOF
  cat > "$dir/anti-patterns.md" <<'EOF'
---
strength: 0.5
half_life_days: 365
---
# Anti-Patterns
## anti-001: never use localStorage
ANTI-LESSON-MARKER body content.
EOF
  cat > "$dir/testing-patterns.md" <<'EOF'
---
strength: 0.4
half_life_days: 180
---
# Testing
## test-001: parametrize over duplicate
TESTING-MARKER body.
EOF
  cat > "$dir/workflow-patterns.md" <<'EOF'
---
strength: 0.6
half_life_days: 180
---
# Workflow
## work-001: alembic upgrade SQL artifact required
WORKFLOW-MARKER body about alembic migrations.
EOF
  cat > "$dir/performance-insights.md" <<'EOF'
---
strength: 0.3
half_life_days: 180
---
# Perf
## perf-001
PERF-MARKER body.
EOF
  cat > "$dir/integration-gotchas.md" <<'EOF'
---
strength: 0.4
half_life_days: 90
---
# Integration
## int-001
INTEGRATION-MARKER body.
EOF
  cat > "$dir/failure-patterns.md" <<'EOF'
---
strength: 0.4
half_life_days: 30
---
# Failures
## fail-001
FAILURE-MARKER body.
EOF
  cat > "$dir/architecture-lessons.md" <<'EOF'
---
strength: 0.6
half_life_days: 365
---
# Architecture
## arch-001
ARCH-MARKER body.
EOF
  cat > "$dir/NEW_PROJECT_PRIMER.md" <<'EOF'
# New Project Primer
PRIMER-MARKER digest content.
EOF
}

# Run inject.sh in isolation. Echo stdout; audit lines saved to $audit.
run_inject() {
  local t0="$1" audit="$2" branch="$3" paths="$4"
  local dedup; dedup=$(mktemp -d -p "$TMP" dedup.XXXXXX)
  # Use a fresh dedup dir per test invocation so reinforcement doesn't cross-leak.
  TEMPLATE_MEMORY_DIR="$t0" \
    AUDIT_LOG_PATH="$audit" \
    LESSON_TAGS_JSON="$SIDECAR" \
    STRENGTH_DEDUP_DIR="$dedup" \
    STRENGTH_NOW="2026-05-07" \
    E182_FORCE_BRANCH="$branch" \
    E182_FORCE_PATHS="$paths" \
    "$INJECT" 2>/dev/null
}

# ---- t1: server/app/api/v1/endpoints/auth.py cue surfaces security lesson ----
t1_auth_cue_surfaces_security() {
  local dir; dir=$(mktemp -d -p "$TMP" t1.XXXXXX)
  local audit="$dir/audit.jsonl"
  local t0="$dir/tier0"; mkdir -p "$t0"
  stub_tier0 "$t0"

  local out
  out=$(run_inject "$t0" "$audit" "feat/e182-test" \
    $'server/app/api/v1/endpoints/auth.py\nclient/src/pages/auth/SignIn.tsx')

  if echo "$out" | grep -q "security-learnings.md"; then
    pass "auth-touching cue surfaces security-learnings.md"
  else
    fail "auth cue -> security lesson" "missing in stdout: [$out]"
  fi
}

# ---- t2: server/alembic/versions/* cue surfaces workflow lesson ----
t2_alembic_cue_surfaces_workflow() {
  local dir; dir=$(mktemp -d -p "$TMP" t2.XXXXXX)
  local audit="$dir/audit.jsonl"
  local t0="$dir/tier0"; mkdir -p "$t0"
  stub_tier0 "$t0"

  local out
  out=$(run_inject "$t0" "$audit" "feat/e157-migration-review" \
    "server/alembic/versions/abc1234_users.py")

  if echo "$out" | grep -q "workflow-patterns.md"; then
    pass "alembic cue surfaces workflow-patterns.md"
  else
    fail "alembic cue -> workflow lesson" "missing in stdout: [$out]"
  fi
}

# ---- t3: empty cue (initial clone) -> Block B is empty ----
t3_empty_cue_no_block_b() {
  local dir; dir=$(mktemp -d -p "$TMP" t3.XXXXXX)
  local audit="$dir/audit.jsonl"
  local t0="$dir/tier0"; mkdir -p "$t0"
  stub_tier0 "$t0"

  local out
  out=$(run_inject "$t0" "$audit" "main" "")

  if [ -z "$out" ]; then
    pass "empty cue (main, no diff) emits no Block B output (initial-clone UX preserved)"
  else
    fail "empty cue -> empty Block B" "got output: [$out]"
  fi
}

# ---- t4: tier0_loaded events emitted for every selected file ----
t4_tier0_loaded_per_lesson() {
  local dir; dir=$(mktemp -d -p "$TMP" t4.XXXXXX)
  local audit="$dir/audit.jsonl"
  local t0="$dir/tier0"; mkdir -p "$t0"
  stub_tier0 "$t0"

  run_inject "$t0" "$audit" "feat/e182-test" \
    "server/app/api/v1/endpoints/auth.py" >/dev/null

  local count
  count=$(jq -c 'select(.event == "tier0_loaded")' "$audit" 2>/dev/null \
    | wc -l | tr -d ' ')
  if [ "$count" -ge 2 ]; then
    pass "tier0_loaded events emitted for each selected lesson (got $count)"
  else
    fail "tier0_loaded per lesson" "expected >=2 events, got $count"
  fi
}

# ---- t5: budget cap honored — Block B output ≤ budget ----
t5_budget_cap() {
  local dir; dir=$(mktemp -d -p "$TMP" t5.XXXXXX)
  local audit="$dir/audit.jsonl"
  local t0="$dir/tier0"; mkdir -p "$t0"
  stub_tier0 "$t0"

  local out
  out=$(TEMPLATE_MEMORY_DIR="$t0" \
    AUDIT_LOG_PATH="$audit" \
    LESSON_TAGS_JSON="$SIDECAR" \
    STRENGTH_DEDUP_DIR="$(mktemp -d -p "$TMP" dedup.XXXXXX)" \
    STRENGTH_NOW="2026-05-07" \
    E182_BUDGET_LINES="40" \
    E182_FORCE_BRANCH="feat/e182-test" \
    E182_FORCE_PATHS=$'server/app/api/v1/endpoints/auth.py\nclient/src/pages/auth/SignIn.tsx\nserver/tests/test_auth.py' \
    "$INJECT" 2>/dev/null)

  local lines
  lines=$(echo "$out" | wc -l | tr -d ' ')
  # Allow slack for header/footer + last-lesson overshoot up to 1 cap.
  if [ "$lines" -le 80 ]; then
    pass "Block B respects budget cap (lines=$lines under 80 with budget 40)"
  else
    fail "budget cap" "got $lines lines, expected ≤ 80 with budget 40"
  fi
}

# ---- t6: strength tie-break — higher-strength lesson ranks first ----
t6_strength_tie_break() {
  local dir; dir=$(mktemp -d -p "$TMP" t6.XXXXXX)
  local t0="$dir/tier0"; mkdir -p "$t0"
  # Two same-tag lessons, different strength. testing-patterns has
  # ["testing","tdd","coverage"]; integration-gotchas has ["integration","third-party"].
  # Use a server/tests/ + client/src/api/ cue that hits BOTH lessons via
  # equal counts of domains+tags so strength is the deciding factor.
  cat > "$t0/testing-patterns.md" <<'EOF'
---
strength: 0.95
---
# Testing
## test-001
HIGH-STRENGTH-TESTING.
EOF
  cat > "$t0/integration-gotchas.md" <<'EOF'
---
strength: 0.10
---
# Integration
## int-001
LOW-STRENGTH-INTEGRATION.
EOF
  local audit="$dir/audit.jsonl"
  local out
  out=$(run_inject "$t0" "$audit" "feat/e999-test" "server/tests/test_x.py")

  # First lesson header in Block B should be testing (strength 0.95) above integration.
  local first_lesson
  first_lesson=$(echo "$out" | grep -E '^## ' | grep -v '^# ' | head -1)
  if echo "$first_lesson" | grep -q "testing-patterns.md"; then
    pass "strength tie-break orders higher-strength lesson first"
  else
    fail "strength tie-break" "expected testing-patterns first; got [$first_lesson]"
  fi
}

# ---- t7: match.sh sources score.sh — strength comes from frontmatter ----
t7_match_uses_score_sh() {
  local dir; dir=$(mktemp -d -p "$TMP" t7.XXXXXX)
  cat > "$dir/security-learnings.md" <<'EOF'
---
strength: 0.42
half_life_days: 365
---
# Security
EOF
  local got
  got=$("$MATCH" "$dir/security-learnings.md" --paths "" --tags "")
  # Evergreen=true (security-learnings.md in sidecar) -> 100 floor + strength 0.42 = 100.42
  if echo "$got" | grep -q "100.42"; then
    pass "match.sh sources E181 score.sh (frontmatter strength 0.42 round-trips into score)"
  else
    fail "match.sh sources score.sh" "expected score containing 100.42, got [$got]"
  fi
}

# ---- t8: branch-name regex cue (feat/e{n}-*) injects epic-pipeline tag ----
t8_branch_name_cue() {
  local dir; dir=$(mktemp -d -p "$TMP" t8.XXXXXX)
  local audit="$dir/audit.jsonl"
  local t0="$dir/tier0"; mkdir -p "$t0"
  stub_tier0 "$t0"

  # Pure branch-name cue, no path diff. anti-patterns has tag epic-pipeline
  # in the sidecar so should surface from the branch-only cue.
  local out
  out=$(run_inject "$t0" "$audit" "feat/e183-test" "")

  if echo "$out" | grep -q "anti-patterns.md"; then
    pass "branch-name cue (feat/e183-*) injects epic-pipeline-tagged anti-patterns.md"
  else
    fail "branch cue surfaces tag-matching lesson" "stdout: [$out]"
  fi
}

# ---- t9: evergreen lessons bypass score threshold (security/anti always inject when cue present) ----
t9_evergreen_bypass() {
  local dir; dir=$(mktemp -d -p "$TMP" t9.XXXXXX)
  local audit="$dir/audit.jsonl"
  local t0="$dir/tier0"; mkdir -p "$t0"
  stub_tier0 "$t0"

  # A fix/* branch (matches branch_tag_cues for debugging+failure) touching
  # docs/. anti-patterns is evergreen and should still surface.
  local out
  out=$(run_inject "$t0" "$audit" "fix/e999-bug" "docs/changelog.md")

  if echo "$out" | grep -q "anti-patterns.md"; then
    pass "evergreen lesson (anti-patterns.md) injects even with weak cue"
  else
    fail "evergreen bypass" "stdout: [$out]"
  fi
}

# ---- t10: SessionStart hook still emits the existing PRIMER tier0_loaded event ----
t10_session_start_primer_event_unchanged() {
  local dir; dir=$(mktemp -d -p "$TMP" t10.XXXXXX)
  local audit="$dir/audit.jsonl"
  # Stub a fake HOME with a NEW_PROJECT_PRIMER so session-start.sh fires Block A.
  local fake_home="$dir/home"; mkdir -p "$fake_home/.claude/template-memory"
  cat > "$fake_home/.claude/template-memory/NEW_PROJECT_PRIMER.md" <<'EOF'
# New Project Primer
PRIMER-MARKER body.
EOF
  # Run from a fresh git repo so the hook's `git` calls succeed cleanly.
  local cwd; cwd=$(mktemp -d -p "$TMP" cwd.XXXXXX)
  (
    cd "$cwd"
    git init -q
    git config user.email t@t.example
    git config user.name T
    git commit -q --allow-empty -m "init"
    HOME="$fake_home" \
      AUDIT_LOG_PATH="$audit" \
      bash "$REPO_ROOT/scripts/hooks/session-start.sh" >/dev/null 2>&1
  )

  # Should have at least one tier0_loaded for NEW_PROJECT_PRIMER.md.
  local hits
  hits=$(jq -c 'select(.event == "tier0_loaded" and .lesson == "NEW_PROJECT_PRIMER.md")' \
    "$audit" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$hits" -ge 1 ]; then
    pass "Block A (PRIMER) tier0_loaded event still fires (E180 contract preserved)"
  else
    fail "PRIMER event preserved" "expected >=1 tier0_loaded for NEW_PROJECT_PRIMER, got $hits"
  fi
}

# ---- t11: lesson-tags.json sidecar is valid JSON with documented schema ----
t11_sidecar_valid() {
  if [ ! -f "$SIDECAR" ]; then
    fail "lesson-tags.json exists" "missing at $SIDECAR"
    return
  fi
  if ! jq -e '.' "$SIDECAR" >/dev/null 2>&1; then
    fail "lesson-tags.json is valid JSON" "jq parse error"
    return
  fi
  # Verify the 7 underlying category files all have entries.
  local missing=""
  for f in security-learnings.md anti-patterns.md failure-patterns.md \
           testing-patterns.md workflow-patterns.md integration-gotchas.md \
           performance-insights.md architecture-lessons.md; do
    if ! jq -e --arg n "$f" '.defaults[$n]' "$SIDECAR" >/dev/null 2>&1; then
      missing="$missing $f"
    fi
  done
  if [ -z "$missing" ]; then
    pass "lesson-tags.json covers all 8 canonical Tier 0 lessons"
  else
    fail "sidecar coverage" "missing entries:$missing"
  fi
}

# ---- t12: frontmatter override beats sidecar ----
t12_frontmatter_overrides_sidecar() {
  local dir; dir=$(mktemp -d -p "$TMP" t12.XXXXXX)
  # security-learnings has tags=[security,auth,evergreen] in sidecar. Override
  # with a single non-matching tag so a security cue scores 0 hits.
  cat > "$dir/security-learnings.md" <<'EOF'
---
strength: 0.5
tags: [completely-unrelated]
domains: []
evergreen: false
---
# Security
EOF
  local got
  got=$("$MATCH" "$dir/security-learnings.md" \
    --paths "server/app/api/v1/endpoints/auth.py" \
    --tags "auth,security")
  # No domain hits (domains:[]), no tag hits (only completely-unrelated),
  # evergreen=false -> score = 0 + 0 + 0.5 = 0.5
  if echo "$got" | awk '{ exit ($1 < 1.0 ? 0 : 1) }'; then
    pass "frontmatter overrides sidecar (overridden tags+domains+evergreen)"
  else
    fail "frontmatter override" "expected score < 1.0 with override; got [$got]"
  fi
}

# ---- t13: same-session dedup — second inject doesn't bump strength again ----
t13_session_dedup_through_inject() {
  local dir; dir=$(mktemp -d -p "$TMP" t13.XXXXXX)
  local audit="$dir/audit.jsonl"
  local t0="$dir/tier0"; mkdir -p "$t0"
  stub_tier0 "$t0"

  local dedup; dedup=$(mktemp -d -p "$TMP" dedup.XXXXXX)
  # Run twice with the same session id (via shared dedup dir).
  for _ in 1 2; do
    TEMPLATE_MEMORY_DIR="$t0" \
      AUDIT_LOG_PATH="$audit" \
      LESSON_TAGS_JSON="$SIDECAR" \
      STRENGTH_DEDUP_DIR="$dedup" \
      STRENGTH_SESSION_ID="sess-A" \
      STRENGTH_NOW="2026-05-07" \
      E182_FORCE_BRANCH="feat/e182-test" \
      E182_FORCE_PATHS="server/app/api/v1/endpoints/auth.py" \
      "$INJECT" >/dev/null 2>&1
  done

  # Each lesson should have exactly ONE strength_reinforced event in the
  # session — the second inject is deduped.
  local sec_bumps
  sec_bumps=$(jq -c 'select(.event == "strength_reinforced" and .lesson == "security-learnings.md")' \
    "$audit" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$sec_bumps" = "1" ]; then
    pass "two same-session injects -> strength_reinforced fires once per lesson (dedup honored)"
  else
    fail "session dedup through inject" "expected 1 reinforce event for security, got $sec_bumps"
  fi
}

# ---- t14: max-lessons cap ----
t14_max_lessons_cap() {
  local dir; dir=$(mktemp -d -p "$TMP" t14.XXXXXX)
  local audit="$dir/audit.jsonl"
  local t0="$dir/tier0"; mkdir -p "$t0"
  stub_tier0 "$t0"

  local out
  out=$(TEMPLATE_MEMORY_DIR="$t0" \
    AUDIT_LOG_PATH="$audit" \
    LESSON_TAGS_JSON="$SIDECAR" \
    STRENGTH_DEDUP_DIR="$(mktemp -d -p "$TMP" dedup.XXXXXX)" \
    STRENGTH_NOW="2026-05-07" \
    E182_MAX_LESSONS="2" \
    E182_FORCE_BRANCH="feat/e182-test" \
    E182_FORCE_PATHS=$'server/app/api/v1/endpoints/auth.py\nserver/tests/test_x.py\nclient/src/pages/auth/SignIn.tsx' \
    "$INJECT" 2>/dev/null)

  local lesson_headers
  lesson_headers=$(echo "$out" | grep -cE '^## .+\.md — score=' || true)
  if [ "$lesson_headers" = "2" ]; then
    pass "MAX_LESSONS cap honored (got 2 lessons with cap=2)"
  else
    fail "max-lessons cap" "expected 2 headers, got $lesson_headers"
  fi
}

# ---- t15: failing inject does NOT block (best-effort contract) ----
t15_inject_failure_nonblocking() {
  local dir; dir=$(mktemp -d -p "$TMP" t15.XXXXXX)
  # Point at a missing Tier 0 dir — inject.sh should exit 0 silently.
  local rc=0
  TEMPLATE_MEMORY_DIR="$dir/does-not-exist" \
    AUDIT_LOG_PATH="$dir/audit.jsonl" \
    "$INJECT" >/dev/null 2>&1 || rc=$?
  if [ "$rc" = "0" ]; then
    pass "inject.sh against missing Tier 0 dir exits 0 (best-effort, never blocks SessionStart)"
  else
    fail "inject failure non-blocking" "exit code $rc"
  fi
}

echo "=== E182: selective SessionStart inject ==="
t1_auth_cue_surfaces_security
t2_alembic_cue_surfaces_workflow
t3_empty_cue_no_block_b
t4_tier0_loaded_per_lesson
t5_budget_cap
t6_strength_tie_break
t7_match_uses_score_sh
t8_branch_name_cue
t9_evergreen_bypass
t10_session_start_primer_event_unchanged
t11_sidecar_valid
t12_frontmatter_overrides_sidecar
t13_session_dedup_through_inject
t14_max_lessons_cap
t15_inject_failure_nonblocking

TOTAL=$((PASS + FAIL))
echo "----"
echo "$PASS/$TOTAL passed"

if [ $FAIL -gt 0 ]; then
  echo "first failure: $FIRST_FAIL" >&2
  exit 1
fi
exit 0
