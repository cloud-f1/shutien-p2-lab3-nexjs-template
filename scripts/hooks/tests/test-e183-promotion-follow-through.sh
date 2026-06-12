#!/usr/bin/env bash
# E183 — Promotion Follow-Through fixture tests.
#
# Covers acceptance criteria:
#   - Stale-promotion detection (age >= 30d + never fired) -> flagged
#   - retrieval_count > 0 suppresses (working as intended)
#   - audit-log retrieval since promotion suppresses (working as intended)
#   - age < 30d suppresses (too early to judge)
#   - Missing audit-log handled gracefully (still flags by frontmatter alone)
#   - Missing Tier 0 dir handled gracefully (no crash, empty report / [])
#   - JSON output emits valid JSON array suitable for piping (E184)
#   - Idempotent: two consecutive runs produce identical output
#   - Originating proposal path surfaced when present
#   - mtime fallback when no `created` frontmatter exists
#
# Tests run in isolated temp directories; the real ~/.claude/template-memory
# and the repo's audit.jsonl are NEVER touched.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/memory/promotion-follow-through.sh"

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

# Build a minimal Tier 0 file with the given created date + retrieval_count.
# created omitted means no frontmatter (mtime fallback path).
make_lesson() {
  local path="$1" created="$2" rc="${3:-0}"
  if [ -z "$created" ]; then
    cat > "$path" <<EOF
# $(basename "$path")
no frontmatter — mtime fallback path.
EOF
  else
    cat > "$path" <<EOF
---
created: $created
retrieval_count: $rc
half_life_days: 365
tier: 0
---
# $(basename "$path")
fixture content.
EOF
  fi
}

# ---- t1: stale lesson (60d, rc=0, no audit) -> FLAGGED ----
t1_stale_lesson_flagged() {
  local dir; dir=$(mktemp -d -p "$TMP" t1.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"
  make_lesson "$dir/stale.md" "2026-03-07" 0  # 61 days before STRENGTH_NOW=2026-05-07

  local out
  out=$(STRENGTH_NOW="2026-05-07" \
        TEMPLATE_MEMORY_DIR="$dir" \
        AUDIT_LOG_PATH="$audit" \
        "$SCRIPT" 2>/dev/null)

  if echo "$out" | grep -q "stale.md" \
     && echo "$out" | grep -q "Premature Promotion Candidates"; then
    pass "stale lesson (61d, rc=0, no audit) appears in report"
  else
    fail "stale lesson flagged" "output: $out"
  fi
}

# ---- t2: young lesson (<30d) is EXCLUDED ----
t2_young_lesson_excluded() {
  local dir; dir=$(mktemp -d -p "$TMP" t2.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"
  make_lesson "$dir/young.md" "2026-04-30" 0  # 7 days before STRENGTH_NOW

  local out
  out=$(STRENGTH_NOW="2026-05-07" \
        TEMPLATE_MEMORY_DIR="$dir" \
        AUDIT_LOG_PATH="$audit" \
        "$SCRIPT" 2>/dev/null)

  if echo "$out" | grep -q "young.md"; then
    fail "young lesson excluded" "young.md should NOT be flagged: $out"
  else
    pass "young lesson (<30d) correctly excluded from report"
  fi
}

# ---- t3: rc>0 suppresses flag (working as intended) ----
t3_retrieved_lesson_excluded() {
  local dir; dir=$(mktemp -d -p "$TMP" t3.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"
  make_lesson "$dir/working.md" "2026-03-07" 5  # 61d old, but rc=5

  local out
  out=$(STRENGTH_NOW="2026-05-07" \
        TEMPLATE_MEMORY_DIR="$dir" \
        AUDIT_LOG_PATH="$audit" \
        "$SCRIPT" 2>/dev/null)

  if echo "$out" | grep -q "working.md"; then
    fail "rc>0 suppresses" "working.md was flagged despite rc=5: $out"
  else
    pass "lesson with retrieval_count>0 correctly excluded"
  fi
}

# ---- t4: audit-log retrieval since promotion suppresses flag ----
t4_audit_log_retrieval_suppresses() {
  local dir; dir=$(mktemp -d -p "$TMP" t4.XXXXXX)
  local audit="$dir/audit.jsonl"
  make_lesson "$dir/cited.md" "2026-03-07" 0  # 61d old, rc=0
  # But audit log shows agent_cited AFTER promotion date.
  cat > "$audit" <<'EOF'
{"ts":"2026-04-15T10:00:00Z","event":"agent_cited","agent":"reviewer","lesson":"cited.md","epic":"E183"}
EOF

  local out
  out=$(STRENGTH_NOW="2026-05-07" \
        TEMPLATE_MEMORY_DIR="$dir" \
        AUDIT_LOG_PATH="$audit" \
        "$SCRIPT" 2>/dev/null)

  if echo "$out" | grep -q "cited.md"; then
    fail "audit retrieval suppresses" "cited.md flagged despite agent_cited: $out"
  else
    pass "lesson with agent_cited event after promotion correctly excluded"
  fi
}

# ---- t5: audit-log retrieval BEFORE promotion does NOT suppress ----
t5_audit_log_pre_promotion_does_not_suppress() {
  local dir; dir=$(mktemp -d -p "$TMP" t5.XXXXXX)
  local audit="$dir/audit.jsonl"
  make_lesson "$dir/late.md" "2026-04-01" 0  # 36d old
  # Audit shows retrieval BEFORE promotion (Jan), should not suppress.
  cat > "$audit" <<'EOF'
{"ts":"2026-01-01T10:00:00Z","event":"tier0_loaded","lesson":"late.md","agent":"session-start","epic":"none"}
EOF

  local out
  out=$(STRENGTH_NOW="2026-05-07" \
        TEMPLATE_MEMORY_DIR="$dir" \
        AUDIT_LOG_PATH="$audit" \
        "$SCRIPT" 2>/dev/null)

  if echo "$out" | grep -q "late.md"; then
    pass "pre-promotion audit retrieval does NOT suppress (lesson still flagged)"
  else
    fail "pre-promotion not-suppressing" "late.md should still flag: $out"
  fi
}

# ---- t6: missing audit log handled gracefully (still flags by frontmatter) ----
t6_missing_audit_log_handled() {
  local dir; dir=$(mktemp -d -p "$TMP" t6.XXXXXX)
  make_lesson "$dir/orphan.md" "2026-03-07" 0

  local out
  out=$(STRENGTH_NOW="2026-05-07" \
        TEMPLATE_MEMORY_DIR="$dir" \
        AUDIT_LOG_PATH="$dir/nonexistent.jsonl" \
        "$SCRIPT" 2>/dev/null)

  if echo "$out" | grep -q "orphan.md"; then
    pass "missing audit log handled — flag based on frontmatter alone"
  else
    fail "missing audit log handled" "no flag emitted; output: $out"
  fi
}

# ---- t7: missing Tier 0 dir handled gracefully (markdown) ----
t7_missing_tier0_dir_markdown() {
  local out
  out=$(TEMPLATE_MEMORY_DIR="$TMP/does-not-exist-$$" \
        AUDIT_LOG_PATH="$TMP/audit-empty" \
        STRENGTH_NOW="2026-05-07" \
        "$SCRIPT" 2>/dev/null)

  local rc=$?
  if [ "$rc" -eq 0 ] && echo "$out" | grep -q "Tier 0 directory not found"; then
    pass "missing Tier 0 dir → exits 0 with informative markdown"
  else
    fail "missing Tier 0 dir handled" "exit=$rc out=$out"
  fi
}

# ---- t8: missing Tier 0 dir handled gracefully (json) ----
t8_missing_tier0_dir_json() {
  local out
  out=$(TEMPLATE_MEMORY_DIR="$TMP/does-not-exist-$$-json" \
        AUDIT_LOG_PATH="$TMP/audit-empty" \
        STRENGTH_NOW="2026-05-07" \
        "$SCRIPT" --json 2>/dev/null)

  if [ "$out" = "[]" ]; then
    pass "missing Tier 0 dir + --json → empty array []"
  else
    fail "missing Tier 0 dir json" "expected '[]', got '$out'"
  fi
}

# ---- t9: JSON output is valid + has expected fields ----
t9_json_output_valid_and_shaped() {
  local dir; dir=$(mktemp -d -p "$TMP" t9.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"
  make_lesson "$dir/json-target.md" "2026-03-07" 0

  local out
  out=$(STRENGTH_NOW="2026-05-07" \
        TEMPLATE_MEMORY_DIR="$dir" \
        AUDIT_LOG_PATH="$audit" \
        "$SCRIPT" --json 2>/dev/null)

  if ! echo "$out" | jq -e . >/dev/null 2>&1; then
    fail "json output valid" "not valid JSON: $out"
    return
  fi

  local len basename age rc
  len=$(echo "$out" | jq 'length')
  basename=$(echo "$out" | jq -r '.[0].basename')
  age=$(echo "$out" | jq -r '.[0].age_days')
  rc=$(echo "$out" | jq -r '.[0].retrieval_count')

  if [ "$len" = "1" ] && [ "$basename" = "json-target.md" ] \
     && [ "$age" -ge 60 ] && [ "$rc" = "0" ]; then
    pass "json output: valid array, basename + age_days + retrieval_count present"
  else
    fail "json shape" "len=$len basename=$basename age=$age rc=$rc"
  fi
}

# ---- t10: idempotent — two runs produce byte-identical output ----
t10_idempotent_markdown() {
  local dir; dir=$(mktemp -d -p "$TMP" t10.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"
  make_lesson "$dir/idem.md" "2026-03-07" 0
  make_lesson "$dir/young2.md" "2026-04-30" 0

  local out1 out2
  out1=$(STRENGTH_NOW="2026-05-07" TEMPLATE_MEMORY_DIR="$dir" AUDIT_LOG_PATH="$audit" "$SCRIPT" 2>/dev/null)
  out2=$(STRENGTH_NOW="2026-05-07" TEMPLATE_MEMORY_DIR="$dir" AUDIT_LOG_PATH="$audit" "$SCRIPT" 2>/dev/null)

  if [ "$out1" = "$out2" ]; then
    pass "two consecutive runs produce identical markdown (idempotent)"
  else
    fail "idempotent" "outputs differ"
  fi
}

# ---- t11: README.md / CLAUDE.md / archive files are skipped ----
t11_meta_files_skipped() {
  local dir; dir=$(mktemp -d -p "$TMP" t11.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"
  make_lesson "$dir/README.md" "2026-01-01" 0
  make_lesson "$dir/CLAUDE.md" "2026-01-01" 0
  make_lesson "$dir/architecture-lessons-archive-2026.md" "2026-01-01" 0
  make_lesson "$dir/real.md" "2026-01-01" 0

  local out
  out=$(STRENGTH_NOW="2026-05-07" TEMPLATE_MEMORY_DIR="$dir" AUDIT_LOG_PATH="$audit" "$SCRIPT" 2>/dev/null)

  if echo "$out" | grep -q "README.md\|CLAUDE.md\|archive-2026"; then
    fail "meta files skipped" "meta file appeared in report: $out"
  elif ! echo "$out" | grep -q "real.md"; then
    fail "meta files skipped" "real.md should still be flagged: $out"
  else
    pass "README.md / CLAUDE.md / *-archive-* correctly skipped, real.md still flagged"
  fi
}

# ---- t12: --quiet exits 0 silently when no candidates ----
t12_quiet_no_candidates() {
  local dir; dir=$(mktemp -d -p "$TMP" t12.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"
  make_lesson "$dir/young3.md" "2026-04-30" 0

  local out
  out=$(STRENGTH_NOW="2026-05-07" TEMPLATE_MEMORY_DIR="$dir" AUDIT_LOG_PATH="$audit" \
        "$SCRIPT" --quiet 2>/dev/null)
  local rc=$?

  if [ "$rc" -eq 0 ] && [ -z "$out" ]; then
    pass "--quiet + no candidates → exit 0, empty stdout"
  else
    fail "--quiet no candidates" "exit=$rc out_len=${#out}"
  fi
}

# ---- t13: originating proposal path is surfaced when present ----
t13_proposal_path_surfaced() {
  local dir; dir=$(mktemp -d -p "$TMP" t13.XXXXXX)
  local audit="$dir/audit.jsonl"
  local proposals; proposals=$(mktemp -d -p "$TMP" proposals.XXXXXX)
  : > "$audit"
  make_lesson "$dir/proposed.md" "2026-03-07" 0
  cat > "$proposals/20260306-120000.md" <<'EOF'
# Promotion Proposal — 2026-03-06

Lessons up for review (3 [GENERALIZABLE] tags from @debugger):

1. proposed.md — auth gotcha pattern
2. ...
EOF

  local out
  out=$(STRENGTH_NOW="2026-05-07" \
        TEMPLATE_MEMORY_DIR="$dir" \
        AUDIT_LOG_PATH="$audit" \
        PROMOTION_PROPOSALS_DIR="$proposals" \
        "$SCRIPT" 2>/dev/null)

  if echo "$out" | grep -q "20260306-120000.md" \
     && echo "$out" | grep -q "@debugger"; then
    pass "proposal path + originating agent (@debugger) surfaced in report"
  else
    fail "proposal path surfaced" "out: $out"
  fi
}

# ---- t14: mtime fallback when no `created` frontmatter ----
t14_mtime_fallback() {
  local dir; dir=$(mktemp -d -p "$TMP" t14.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"
  make_lesson "$dir/no-fm.md" ""  # no frontmatter at all
  # Set mtime to 60 days before STRENGTH_NOW (2026-05-07).
  # 2026-03-08 = 60 days earlier.
  touch -t 202603080000 "$dir/no-fm.md" 2>/dev/null \
    || touch -d "2026-03-08" "$dir/no-fm.md" 2>/dev/null \
    || true

  local out
  out=$(STRENGTH_NOW="2026-05-07" \
        TEMPLATE_MEMORY_DIR="$dir" \
        AUDIT_LOG_PATH="$audit" \
        "$SCRIPT" 2>/dev/null)

  if echo "$out" | grep -q "no-fm.md"; then
    pass "lesson without 'created' frontmatter falls back to file mtime"
  else
    fail "mtime fallback" "no-fm.md not flagged; out: $out"
  fi
}

# ---- t15: multiple candidates count + render correctly ----
t15_multi_candidates() {
  local dir; dir=$(mktemp -d -p "$TMP" t15.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"
  make_lesson "$dir/cand1.md" "2026-03-07" 0
  make_lesson "$dir/cand2.md" "2026-03-08" 0
  make_lesson "$dir/cand3.md" "2026-03-09" 0
  make_lesson "$dir/working.md" "2026-03-07" 5  # excluded
  make_lesson "$dir/young.md" "2026-04-30" 0    # excluded

  local out
  out=$(STRENGTH_NOW="2026-05-07" TEMPLATE_MEMORY_DIR="$dir" AUDIT_LOG_PATH="$audit" "$SCRIPT" 2>/dev/null)

  local hit_count
  hit_count=$(echo "$out" | grep -c "^### " || true)

  if echo "$out" | grep -q "Premature Promotion Candidates (3)" \
     && [ "$hit_count" = "3" ]; then
    pass "3 stale candidates + 2 excluded → 'Candidates (3)' header + 3 H3 blocks"
  else
    fail "multi candidates" "header/h3 mismatch; hit_count=$hit_count out=$out"
  fi
}

# ---- t16: STALE_DAYS env override is honored ----
t16_stale_days_override() {
  local dir; dir=$(mktemp -d -p "$TMP" t16.XXXXXX)
  local audit="$dir/audit.jsonl"
  : > "$audit"
  make_lesson "$dir/medium.md" "2026-04-15" 0  # 22d old — under default 30d, over 14d

  local out_default out_override
  out_default=$(STRENGTH_NOW="2026-05-07" TEMPLATE_MEMORY_DIR="$dir" AUDIT_LOG_PATH="$audit" "$SCRIPT" 2>/dev/null)
  out_override=$(STRENGTH_NOW="2026-05-07" STALE_DAYS=14 TEMPLATE_MEMORY_DIR="$dir" AUDIT_LOG_PATH="$audit" "$SCRIPT" 2>/dev/null)

  if ! echo "$out_default" | grep -q "medium.md" \
     && echo "$out_override" | grep -q "medium.md"; then
    pass "STALE_DAYS env override honored (default excludes; STALE_DAYS=14 includes)"
  else
    fail "stale_days override" "default-includes? override-excludes?"
  fi
}

# ---- t17: rule_fired audit event also suppresses (not just agent_cited) ----
t17_rule_fired_suppresses() {
  local dir; dir=$(mktemp -d -p "$TMP" t17.XXXXXX)
  local audit="$dir/audit.jsonl"
  make_lesson "$dir/rule-cited.md" "2026-03-07" 0
  cat > "$audit" <<'EOF'
{"ts":"2026-04-15T10:00:00Z","event":"rule_fired","rule_id":21,"severity":"block","lesson":"rule-cited.md","epic":"E183"}
EOF

  local out
  out=$(STRENGTH_NOW="2026-05-07" TEMPLATE_MEMORY_DIR="$dir" AUDIT_LOG_PATH="$audit" "$SCRIPT" 2>/dev/null)

  if echo "$out" | grep -q "rule-cited.md"; then
    fail "rule_fired suppresses" "rule-cited.md flagged despite rule_fired event: $out"
  else
    pass "rule_fired event after promotion correctly suppresses flag"
  fi
}

echo "=== E183: promotion follow-through ==="
t1_stale_lesson_flagged
t2_young_lesson_excluded
t3_retrieved_lesson_excluded
t4_audit_log_retrieval_suppresses
t5_audit_log_pre_promotion_does_not_suppress
t6_missing_audit_log_handled
t7_missing_tier0_dir_markdown
t8_missing_tier0_dir_json
t9_json_output_valid_and_shaped
t10_idempotent_markdown
t11_meta_files_skipped
t12_quiet_no_candidates
t13_proposal_path_surfaced
t14_mtime_fallback
t15_multi_candidates
t16_stale_days_override
t17_rule_fired_suppresses

TOTAL=$((PASS + FAIL))
echo "----"
echo "$PASS/$TOTAL passed"

if [ $FAIL -gt 0 ]; then
  echo "first failure: $FIRST_FAIL" >&2
  exit 1
fi
exit 0
