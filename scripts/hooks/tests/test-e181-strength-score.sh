#!/usr/bin/env bash
# E181 — Lesson Strength Score fixture tests.
#
# Covers acceptance criteria:
#   - Migration adds the 4 E181 fields idempotently
#   - score.sh get returns clamped strength (default 0.5 when missing)
#   - score.sh reinforce applies correct deltas with clamping
#   - score.sh reinforce dedupes within a session (same signal -> only one bump)
#   - score.sh decay matches expected math within 1% tolerance
#   - score.sh decay-all walks all 8 known files
#   - score.sh flag-weak prints lessons with S < 0.10
#   - audit log gets `strength_reinforced` and `strength_decayed` events
#
# Tests are isolated under a temp directory; they DO NOT touch the real
# ~/.claude/template-memory or the repo's own audit log.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SCORE="$REPO_ROOT/scripts/memory/score.sh"
MIGRATE="$REPO_ROOT/scripts/memory/migrate-strength.sh"
DEFAULTS_JSON="$REPO_ROOT/scripts/memory/half-life-defaults.json"

[ -x "$SCORE" ] || chmod +x "$SCORE" 2>/dev/null || true
[ -x "$MIGRATE" ] || chmod +x "$MIGRATE" 2>/dev/null || true

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

# Approx-equal helper: |a - b| < tol.
approx_eq() {
  local a="$1" b="$2" tol="${3:-0.01}"
  awk -v a="$a" -v b="$b" -v t="$tol" 'BEGIN {
    d = a - b; if (d < 0) d = -d; exit (d < t ? 0 : 1)
  }'
}

# Make a fresh dedup dir per test invocation so signals are not cross-leaked.
fresh_dedup() {
  local d
  d=$(mktemp -d -p "$TMP" dedup.XXXXXX)
  echo "$d"
}

# Stub a target dir mirroring the 8 documented Tier 0 files.
stub_tier0() {
  local dir="$1"
  for name in $(jq -r '.defaults | keys[]' "$DEFAULTS_JSON"); do
    cat > "$dir/$name" <<EOF
# $name
fixture content for $name
EOF
  done
}

# ---- t1: migration inserts all 4 E181 fields on bare files ----
t1_migration_inserts_fields() {
  local dir; dir=$(mktemp -d -p "$TMP" t1.XXXXXX)
  stub_tier0 "$dir"
  HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" \
    STRENGTH_NOW="2026-05-07" \
    "$MIGRATE" --dir "$dir" >/dev/null

  local missing=0
  for name in $(jq -r '.defaults | keys[]' "$DEFAULTS_JSON"); do
    for key in strength last_retrieved retrieval_count created; do
      if ! grep -q "^${key}: " "$dir/$name"; then
        echo "    -> $name missing key $key"
        missing=$((missing + 1))
      fi
    done
  done
  if [ "$missing" = "0" ]; then
    pass "migration inserts strength/last_retrieved/retrieval_count/created on all 8 files"
  else
    fail "migration inserts all 4 fields on every file" "$missing keys missing"
  fi
}

# ---- t2: migration is idempotent (second run preserves values) ----
t2_migration_idempotent() {
  local dir; dir=$(mktemp -d -p "$TMP" t2.XXXXXX)
  stub_tier0 "$dir"
  HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" \
    STRENGTH_NOW="2026-05-07" \
    "$MIGRATE" --dir "$dir" >/dev/null

  # Hand-edit one file's strength to a non-default value to prove rerun preserves.
  local target="$dir/anti-patterns.md"
  awk '{ if ($0 ~ /^strength: /) print "strength: 0.9999"; else print }' "$target" > "$target.tmp"
  mv "$target.tmp" "$target"

  HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" \
    STRENGTH_NOW="2026-05-08" \
    "$MIGRATE" --dir "$dir" >/dev/null

  if grep -q "^strength: 0.9999$" "$target"; then
    pass "migration preserves existing strength value on rerun"
  else
    local got; got=$(grep "^strength:" "$target" | head -1)
    fail "migration is idempotent" "expected 'strength: 0.9999', got '$got'"
  fi
}

# ---- t3: score.sh get returns 0.5 default when no strength set ----
t3_get_default() {
  local dir; dir=$(mktemp -d -p "$TMP" t3.XXXXXX)
  cat > "$dir/anti-patterns.md" <<'EOF'
# Anti-Patterns
no frontmatter.
EOF
  local got; got=$("$SCORE" get "$dir/anti-patterns.md")
  if approx_eq "$got" "0.5" 0.0001; then
    pass "score.sh get with no frontmatter returns 0.5 default"
  else
    fail "score.sh get default" "expected 0.5 got $got"
  fi
}

# ---- t4: reinforce tier0_loaded -> +0.05 ----
t4_reinforce_tier0_loaded() {
  local dir; dir=$(mktemp -d -p "$TMP" t4.XXXXXX)
  local audit="$dir/audit.jsonl"
  local dedup; dedup=$(fresh_dedup)
  cat > "$dir/anti-patterns.md" <<'EOF'
---
strength: 0.5
last_retrieved: 2026-05-01
retrieval_count: 0
half_life_days: 365
---
# Anti-Patterns
EOF
  STRENGTH_NOW="2026-05-07" \
    STRENGTH_DEDUP_DIR="$dedup" \
    AUDIT_LOG_PATH="$audit" \
    HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" \
    "$SCORE" reinforce "$dir/anti-patterns.md" tier0_loaded >/dev/null

  local got; got=$("$SCORE" get "$dir/anti-patterns.md")
  if approx_eq "$got" "0.55" 0.001; then
    pass "reinforce tier0_loaded bumps 0.5 -> 0.55"
  else
    fail "reinforce tier0_loaded -> +0.05" "expected ~0.55 got $got"
  fi
}

# ---- t5: reinforce rule_fired -> +0.10, agent_cited -> +0.15 ----
t5_reinforce_other_signals() {
  local dir; dir=$(mktemp -d -p "$TMP" t5.XXXXXX)
  local audit="$dir/audit.jsonl"

  # rule_fired
  local d1; d1=$(fresh_dedup)
  cat > "$dir/r.md" <<'EOF'
---
strength: 0.4
last_retrieved: 2026-05-01
retrieval_count: 0
half_life_days: 90
---
EOF
  STRENGTH_DEDUP_DIR="$d1" AUDIT_LOG_PATH="$audit" STRENGTH_NOW="2026-05-07" \
    "$SCORE" reinforce "$dir/r.md" rule_fired >/dev/null
  local r; r=$("$SCORE" get "$dir/r.md")

  # agent_cited
  local d2; d2=$(fresh_dedup)
  cat > "$dir/a.md" <<'EOF'
---
strength: 0.4
last_retrieved: 2026-05-01
retrieval_count: 0
half_life_days: 90
---
EOF
  STRENGTH_DEDUP_DIR="$d2" AUDIT_LOG_PATH="$audit" STRENGTH_NOW="2026-05-07" \
    "$SCORE" reinforce "$dir/a.md" agent_cited >/dev/null
  local a; a=$("$SCORE" get "$dir/a.md")

  if approx_eq "$r" "0.5" 0.001 && approx_eq "$a" "0.55" 0.001; then
    pass "reinforce rule_fired (+0.10) + agent_cited (+0.15) deltas correct"
  else
    fail "reinforce delta correctness" "rule_fired=$r (want 0.5), agent_cited=$a (want 0.55)"
  fi
}

# ---- t6: reinforce clamps to 1.0 ----
t6_reinforce_clamps() {
  local dir; dir=$(mktemp -d -p "$TMP" t6.XXXXXX)
  local audit="$dir/audit.jsonl"
  local dedup; dedup=$(fresh_dedup)
  cat > "$dir/anti-patterns.md" <<'EOF'
---
strength: 0.95
last_retrieved: 2026-05-01
retrieval_count: 99
half_life_days: 365
---
EOF
  STRENGTH_DEDUP_DIR="$dedup" AUDIT_LOG_PATH="$audit" STRENGTH_NOW="2026-05-07" \
    "$SCORE" reinforce "$dir/anti-patterns.md" agent_cited >/dev/null
  local got; got=$("$SCORE" get "$dir/anti-patterns.md")
  if approx_eq "$got" "1.0" 0.001; then
    pass "reinforce clamps strength to 1.0 (0.95 + 0.15 -> 1.0)"
  else
    fail "reinforce clamps to 1.0" "got $got"
  fi
}

# ---- t7: same-session dedup (5x tier0_loaded -> only one bump) ----
t7_session_dedup() {
  local dir; dir=$(mktemp -d -p "$TMP" t7.XXXXXX)
  local audit="$dir/audit.jsonl"
  local dedup; dedup=$(fresh_dedup)
  cat > "$dir/anti-patterns.md" <<'EOF'
---
strength: 0.5
last_retrieved: 2026-05-01
retrieval_count: 0
half_life_days: 365
---
EOF
  for _ in 1 2 3 4 5; do
    STRENGTH_DEDUP_DIR="$dedup" AUDIT_LOG_PATH="$audit" STRENGTH_NOW="2026-05-07" \
      STRENGTH_SESSION_ID="sess-A" \
      "$SCORE" reinforce "$dir/anti-patterns.md" tier0_loaded >/dev/null
  done
  local got; got=$("$SCORE" get "$dir/anti-patterns.md")
  if approx_eq "$got" "0.55" 0.001; then
    pass "5x tier0_loaded in same session -> strength bumps only once (0.55)"
  else
    fail "session dedup" "expected ~0.55 after 5x same-signal got $got"
  fi
}

# ---- t8: different sessions DO bump separately ----
t8_separate_sessions() {
  local dir; dir=$(mktemp -d -p "$TMP" t8.XXXXXX)
  local audit="$dir/audit.jsonl"
  local dedup; dedup=$(fresh_dedup)
  cat > "$dir/anti-patterns.md" <<'EOF'
---
strength: 0.5
last_retrieved: 2026-05-01
retrieval_count: 0
half_life_days: 365
---
EOF
  STRENGTH_DEDUP_DIR="$dedup" AUDIT_LOG_PATH="$audit" STRENGTH_SESSION_ID="sess-A" STRENGTH_NOW="2026-05-07" \
    "$SCORE" reinforce "$dir/anti-patterns.md" tier0_loaded >/dev/null
  STRENGTH_DEDUP_DIR="$dedup" AUDIT_LOG_PATH="$audit" STRENGTH_SESSION_ID="sess-B" STRENGTH_NOW="2026-05-07" \
    "$SCORE" reinforce "$dir/anti-patterns.md" tier0_loaded >/dev/null
  local got; got=$("$SCORE" get "$dir/anti-patterns.md")
  # 0.5 -> 0.55 -> 0.60
  if approx_eq "$got" "0.60" 0.001; then
    pass "two distinct sessions -> two bumps (0.5 -> 0.6)"
  else
    fail "distinct sessions stack" "expected 0.6 got $got"
  fi
}

# ---- t9: decay math at exactly one half-life -> S/2 ----
t9_decay_one_half_life() {
  local dir; dir=$(mktemp -d -p "$TMP" t9.XXXXXX)
  local audit="$dir/audit.jsonl"
  cat > "$dir/test.md" <<'EOF'
---
strength: 0.5
last_retrieved: 2026-04-07
retrieval_count: 5
half_life_days: 30
---
EOF
  STRENGTH_NOW="2026-05-07" AUDIT_LOG_PATH="$audit" \
    "$SCORE" decay "$dir/test.md" >/dev/null
  local got; got=$("$SCORE" get "$dir/test.md")
  # 30 days at half_life=30 -> S = 0.5 * 0.5^1 = 0.25
  if approx_eq "$got" "0.25" 0.005; then
    pass "decay at exactly one half-life: 0.5 -> 0.25 (within 1%)"
  else
    fail "decay one half-life" "expected 0.25 got $got"
  fi
}

# ---- t10: decay math at half a half-life -> S * 0.707 ----
t10_decay_partial_half_life() {
  local dir; dir=$(mktemp -d -p "$TMP" t10.XXXXXX)
  local audit="$dir/audit.jsonl"
  cat > "$dir/test.md" <<'EOF'
---
strength: 1.0
last_retrieved: 2026-04-22
retrieval_count: 1
half_life_days: 30
---
EOF
  STRENGTH_NOW="2026-05-07" AUDIT_LOG_PATH="$audit" \
    "$SCORE" decay "$dir/test.md" >/dev/null
  local got; got=$("$SCORE" get "$dir/test.md")
  # 15 days at half_life=30 -> S = 1.0 * 0.5^0.5 ~= 0.7071
  if approx_eq "$got" "0.7071" 0.01; then
    pass "decay at half a half-life: 1.0 -> 0.7071 (within 1%)"
  else
    fail "decay partial half-life" "expected ~0.7071 got $got"
  fi
}

# ---- t11: decay leaves evergreen lessons (half_life=365) barely moved ----
t11_decay_evergreen_barely_moves() {
  local dir; dir=$(mktemp -d -p "$TMP" t11.XXXXXX)
  local audit="$dir/audit.jsonl"
  cat > "$dir/anti-patterns.md" <<'EOF'
---
strength: 0.8
last_retrieved: 2026-05-01
retrieval_count: 1
half_life_days: 365
---
EOF
  STRENGTH_NOW="2026-05-07" AUDIT_LOG_PATH="$audit" HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" \
    "$SCORE" decay "$dir/anti-patterns.md" >/dev/null
  local got; got=$("$SCORE" get "$dir/anti-patterns.md")
  # 6 days at half_life=365 -> S = 0.8 * 0.5^(6/365) ~= 0.7909
  if approx_eq "$got" "0.7909" 0.01; then
    pass "decay on evergreen (half_life=365) barely moves over 6 days (0.8 -> ~0.79)"
  else
    fail "decay evergreen" "expected ~0.79 got $got"
  fi
}

# ---- t12: decay-all walks all 8 known Tier 0 files ----
t12_decay_all() {
  local dir; dir=$(mktemp -d -p "$TMP" t12.XXXXXX)
  local audit="$dir/audit.jsonl"
  stub_tier0 "$dir"
  HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$MIGRATE" --dir "$dir" >/dev/null
  AUDIT_LOG_PATH="$audit" HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$SCORE" decay-all "$dir" >/dev/null

  local count
  count=$(jq -c 'select(.event == "strength_decayed")' "$audit" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$count" = "8" ]; then
    pass "decay-all walks all 8 Tier 0 files (8 strength_decayed events)"
  else
    fail "decay-all walks all 8 files" "got $count strength_decayed events"
  fi
}

# ---- t13: flag-weak prints S < 0.10 ----
t13_flag_weak() {
  local dir; dir=$(mktemp -d -p "$TMP" t13.XXXXXX)
  stub_tier0 "$dir"
  # Hand-set one file's strength below threshold, leave others above.
  for name in $(jq -r '.defaults | keys[]' "$DEFAULTS_JSON"); do
    if [ "$name" = "failure-patterns.md" ]; then
      cat > "$dir/$name" <<EOF
---
strength: 0.05
last_retrieved: 2026-01-01
retrieval_count: 0
half_life_days: 30
---
# $name
EOF
    else
      cat > "$dir/$name" <<EOF
---
strength: 0.5
last_retrieved: 2026-05-07
retrieval_count: 0
half_life_days: 365
---
# $name
EOF
    fi
  done

  local out; out=$(HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" "$SCORE" flag-weak "$dir")
  local hits; hits=$(echo "$out" | grep -c "failure-patterns.md" || true)
  local nonweak; nonweak=$(echo "$out" | grep -c "anti-patterns.md" || true)
  if [ "$hits" = "1" ] && [ "$nonweak" = "0" ]; then
    pass "flag-weak prints only files with S < 0.10 (failure-patterns.md flagged, anti-patterns.md not)"
  else
    fail "flag-weak threshold" "weak hits=$hits nonweak=$nonweak out=[$out]"
  fi
}

# ---- t14: audit log emits strength_reinforced + strength_decayed events ----
t14_audit_emits_events() {
  local dir; dir=$(mktemp -d -p "$TMP" t14.XXXXXX)
  local audit="$dir/audit.jsonl"
  local dedup; dedup=$(fresh_dedup)
  cat > "$dir/anti-patterns.md" <<'EOF'
---
strength: 0.5
last_retrieved: 2026-05-01
retrieval_count: 0
half_life_days: 365
---
EOF
  STRENGTH_DEDUP_DIR="$dedup" AUDIT_LOG_PATH="$audit" STRENGTH_NOW="2026-05-07" \
    "$SCORE" reinforce "$dir/anti-patterns.md" tier0_loaded >/dev/null
  AUDIT_LOG_PATH="$audit" STRENGTH_NOW="2026-05-07" \
    "$SCORE" decay "$dir/anti-patterns.md" >/dev/null

  local r; r=$(jq -c 'select(.event == "strength_reinforced")' "$audit" 2>/dev/null | wc -l | tr -d ' ')
  local d; d=$(jq -c 'select(.event == "strength_decayed")' "$audit" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$r" = "1" ] && [ "$d" = "1" ]; then
    pass "audit emits 1 strength_reinforced + 1 strength_decayed event"
  else
    fail "audit emit counts" "reinforced=$r decayed=$d"
  fi
}

# ---- t15: strength_reinforced event carries lesson + signal + strength fields ----
t15_audit_event_fields() {
  local dir; dir=$(mktemp -d -p "$TMP" t15.XXXXXX)
  local audit="$dir/audit.jsonl"
  local dedup; dedup=$(fresh_dedup)
  cat > "$dir/anti-patterns.md" <<'EOF'
---
strength: 0.5
last_retrieved: 2026-05-01
retrieval_count: 0
half_life_days: 365
---
EOF
  STRENGTH_DEDUP_DIR="$dedup" AUDIT_LOG_PATH="$audit" STRENGTH_NOW="2026-05-07" \
    "$SCORE" reinforce "$dir/anti-patterns.md" agent_cited >/dev/null
  local hit
  hit=$(jq -c 'select(.event == "strength_reinforced")' "$audit" 2>/dev/null | tail -1)
  local lesson signal s
  lesson=$(echo "$hit" | jq -r .lesson)
  signal=$(echo "$hit" | jq -r .signal)
  s=$(echo "$hit" | jq -r .strength)
  if [ "$lesson" = "anti-patterns.md" ] && [ "$signal" = "agent_cited" ] && approx_eq "$s" "0.65" 0.001; then
    pass "strength_reinforced carries lesson + signal + strength (lesson=$lesson signal=$signal strength=$s)"
  else
    fail "strength_reinforced fields" "lesson=$lesson signal=$signal strength=$s"
  fi
}

# ---- t16: unknown signal -> error exit ----
t16_unknown_signal() {
  local dir; dir=$(mktemp -d -p "$TMP" t16.XXXXXX)
  cat > "$dir/anti-patterns.md" <<'EOF'
---
strength: 0.5
last_retrieved: 2026-05-01
retrieval_count: 0
half_life_days: 365
---
EOF
  if STRENGTH_DEDUP_DIR="$(fresh_dedup)" AUDIT_LOG_PATH="$dir/audit.jsonl" \
       "$SCORE" reinforce "$dir/anti-patterns.md" bogus_signal 2>/dev/null; then
    fail "unknown signal -> nonzero exit" "got exit 0"
  else
    pass "unknown signal exits non-zero"
  fi
}

# ---- t17: post-migration content body unchanged ----
t17_migration_preserves_body() {
  local dir; dir=$(mktemp -d -p "$TMP" t17.XXXXXX)
  cat > "$dir/anti-patterns.md" <<'EOF'
---
half_life_days: 365
tier: 0
---
# Anti-Patterns
## anti-001: do this thing
body content stays.
EOF
  HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$MIGRATE" --dir "$dir" >/dev/null
  if grep -q "^# Anti-Patterns$" "$dir/anti-patterns.md" \
     && grep -q "^## anti-001:" "$dir/anti-patterns.md" \
     && grep -q "^body content stays\.$" "$dir/anti-patterns.md"; then
    pass "migration preserves content body verbatim"
  else
    fail "migration preserves body" "headings or body lost"
  fi
}

# ---- t18: decay-all completes in <2s on 8-file fixture (perf budget) ----
t18_decay_all_perf_budget() {
  local dir; dir=$(mktemp -d -p "$TMP" t18.XXXXXX)
  local audit="$dir/audit.jsonl"
  stub_tier0 "$dir"
  HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$MIGRATE" --dir "$dir" >/dev/null

  local start_ns end_ns elapsed_ms
  # macOS doesn't have GNU `date +%N`; fall back to Python or just trust < a few seconds.
  start_ns=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || echo "0")
  AUDIT_LOG_PATH="$audit" HALF_LIFE_DEFAULTS_JSON="$DEFAULTS_JSON" STRENGTH_NOW="2026-05-07" \
    "$SCORE" decay-all "$dir" >/dev/null
  end_ns=$(python3 -c "import time; print(int(time.time()*1000))" 2>/dev/null || echo "0")
  elapsed_ms=$((end_ns - start_ns))

  if [ "$elapsed_ms" = "0" ]; then
    pass "decay-all perf budget skipped (no python3 to measure)"
    return
  fi
  if [ "$elapsed_ms" -lt 2000 ]; then
    pass "decay-all completes in <2s on 8-file fixture (${elapsed_ms}ms)"
  else
    fail "decay-all perf budget" "took ${elapsed_ms}ms (limit 2000ms)"
  fi
}

echo "=== E181: lesson strength score ==="
t1_migration_inserts_fields
t2_migration_idempotent
t3_get_default
t4_reinforce_tier0_loaded
t5_reinforce_other_signals
t6_reinforce_clamps
t7_session_dedup
t8_separate_sessions
t9_decay_one_half_life
t10_decay_partial_half_life
t11_decay_evergreen_barely_moves
t12_decay_all
t13_flag_weak
t14_audit_emits_events
t15_audit_event_fields
t16_unknown_signal
t17_migration_preserves_body
t18_decay_all_perf_budget

TOTAL=$((PASS + FAIL))
echo "----"
echo "$PASS/$TOTAL passed"

if [ $FAIL -gt 0 ]; then
  echo "first failure: $FIRST_FAIL" >&2
  exit 1
fi
exit 0
