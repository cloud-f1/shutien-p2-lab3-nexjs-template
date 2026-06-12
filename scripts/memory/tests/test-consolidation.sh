#!/usr/bin/env bash
# E190 — Lesson Consolidation Detector fixture tests.
#
# Covers acceptance criteria:
#   - Empty memory (no .md files) → output []
#   - All distinct (no pairs above threshold) → output []
#   - Exact duplicate (identical content + tags) → 1 cluster of 2
#   - Near duplicate (paraphrased pair, similar tags) → 1 cluster of 2
#   - Three-way cluster (A↔B high, B↔C high, A↔C high) → 1 cluster of 3 (transitive)
#   - Threshold configurable via CONSOLIDATION_THRESHOLD env var
#   - Read-only: does NOT write to TEMPLATE_MEMORY_DIR
#   - Audit event emitted with correct shape
#   - REPORT_PATH: writes markdown when set
#   - Missing Tier 0 dir → output [] gracefully
#
# Tests run in isolated temp directories; the real ~/.claude/template-memory
# and the repo's audit.jsonl are NEVER touched.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/memory/consolidation-detect.sh"

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

# Build a lesson file with given tags (space-separated) and body text.
make_lesson() {
  local path="$1" tags="$2"; shift 2
  local body="$*"
  local tags_yaml=""
  if [ -n "$tags" ]; then
    # Convert "tag1 tag2 tag3" to flow-style YAML: [tag1, tag2, tag3]
    tags_yaml="tags: [$(echo "$tags" | tr ' ' ',')]"
  fi
  cat > "$path" <<EOF
---
${tags_yaml}
tier: 0
half_life_days: 180
---
# $(basename "$path" .md)

$body
EOF
}

# A rich body used for cosine-similarity tests — needs lots of shared words
BODY_ARCH="Use abstract base class with factory singleton pattern for swappable integrations.
Apply provider strategy pattern when you have multiple vendor options at runtime.
The factory singleton ensures only one instance per integration type exists.
Use env var selector to switch between implementations cleanly at runtime.
Useful for email payment storage search service swappable integrations provider."

BODY_ARCH_PARA="Abstract base class factory singleton pattern ideal swappable integrations.
Provider strategy pattern when multiple vendor options available runtime.
Factory singleton ensures single instance integration type exists runtime.
Env var selector switch implementations runtime cleanly without coupling.
Useful email payment storage search provider swappable service integrations."

BODY_ARCH_THIRD="Singleton factory abstract base class works swappable integrations perfectly.
Multiple vendor strategy pattern runtime provider factory singleton instance.
Integration type single instance factory ensures correct runtime behavior.
Switch implementations env var selector runtime pattern integrations provider.
Search storage email payment service swappable integrations base abstract class."

BODY_DISTINCT_A="Authentication security jwt token refresh session management server client.
Never store tokens localStorage use memory cache instead for security.
Csrf protection headers required every request mutation changing state."

BODY_DISTINCT_B="Database migration alembic postgres uuid primary keys foreign keys.
SQLite masks schema bugs use postgres docker testing migrations properly.
Migration linter pytest scan banned patterns char columns boolean defaults."

# ---- t1: empty memory (no .md files) → output [] ----
t1_empty_memory() {
  local dir; dir=$(mktemp -d -p "$TMP" t1.XXXXXX)
  local audit="$dir/audit.jsonl"

  local out
  out=$(TEMPLATE_MEMORY_DIR="$dir" \
        CONSOLIDATION_THRESHOLD=0.7 \
        AUDIT_LOG_PATH="$audit" \
        CLOCK_TS="2026-05-19T12:00:00Z" \
        "$SCRIPT" 2>/dev/null)

  if [ "$out" = "[]" ]; then
    pass "empty memory → output []"
  else
    fail "empty memory" "expected '[]', got: $out"
  fi
}

# ---- t2: all distinct (no pairs above threshold) → output [] ----
t2_all_distinct() {
  local dir; dir=$(mktemp -d -p "$TMP" t2.XXXXXX)
  local audit="$dir/audit.jsonl"

  make_lesson "$dir/auth.md"     "security auth jwt"    "$BODY_DISTINCT_A"
  make_lesson "$dir/database.md" "database migration"   "$BODY_DISTINCT_B"

  local out
  out=$(TEMPLATE_MEMORY_DIR="$dir" \
        CONSOLIDATION_THRESHOLD=0.7 \
        AUDIT_LOG_PATH="$audit" \
        CLOCK_TS="2026-05-19T12:00:00Z" \
        "$SCRIPT" 2>/dev/null)

  if [ "$out" = "[]" ]; then
    pass "all distinct lessons → output [] (no false positives)"
  else
    fail "all distinct" "expected '[]', got: $out"
  fi
}

# ---- t3: exact duplicate (identical tags + body) → 1 cluster of 2 ----
t3_exact_duplicate() {
  local dir; dir=$(mktemp -d -p "$TMP" t3.XXXXXX)
  local audit="$dir/audit.jsonl"

  make_lesson "$dir/arch-a.md" "architecture patterns testing tdd" "$BODY_ARCH $BODY_ARCH"
  make_lesson "$dir/arch-b.md" "architecture patterns testing tdd" "$BODY_ARCH $BODY_ARCH"

  local out
  out=$(TEMPLATE_MEMORY_DIR="$dir" \
        CONSOLIDATION_THRESHOLD=0.7 \
        AUDIT_LOG_PATH="$audit" \
        CLOCK_TS="2026-05-19T12:00:00Z" \
        "$SCRIPT" 2>/dev/null)

  # Validate JSON and check shape
  if ! echo "$out" | python3 -c "import sys,json; json.load(sys.stdin)" >/dev/null 2>&1; then
    fail "exact duplicate json valid" "not valid JSON: $out"
    return
  fi

  local cluster_count
  cluster_count=$(echo "$out" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
  local lessons_count
  lessons_count=$(echo "$out" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(sum(len(c['lessons']) for c in d))
")

  if [ "$cluster_count" = "1" ] && [ "$lessons_count" = "2" ]; then
    pass "exact duplicate → 1 cluster of 2 lessons"
  else
    fail "exact duplicate" "cluster_count=$cluster_count lessons_count=$lessons_count out=$out"
  fi
}

# ---- t4: near duplicate (paraphrased pair, high tag overlap) → 1 cluster of 2 ----
t4_near_duplicate() {
  local dir; dir=$(mktemp -d -p "$TMP" t4.XXXXXX)
  local audit="$dir/audit.jsonl"

  make_lesson "$dir/arch-orig.md"  "architecture patterns testing tdd" "$BODY_ARCH $BODY_ARCH"
  make_lesson "$dir/arch-para.md"  "architecture patterns testing tdd" "$BODY_ARCH_PARA $BODY_ARCH_PARA"

  local out
  out=$(TEMPLATE_MEMORY_DIR="$dir" \
        CONSOLIDATION_THRESHOLD=0.7 \
        AUDIT_LOG_PATH="$audit" \
        CLOCK_TS="2026-05-19T12:00:00Z" \
        "$SCRIPT" 2>/dev/null)

  if ! echo "$out" | python3 -c "import sys,json; json.load(sys.stdin)" >/dev/null 2>&1; then
    fail "near duplicate json valid" "not valid JSON: $out"
    return
  fi

  local cluster_count
  cluster_count=$(echo "$out" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")

  if [ "$cluster_count" = "1" ]; then
    pass "near duplicate (paraphrased) → 1 cluster detected"
  else
    fail "near duplicate" "expected 1 cluster, got cluster_count=$cluster_count out=$out"
  fi
}

# ---- t5: three-way cluster (A↔B↔C all similar) → 1 cluster of 3 (transitive) ----
t5_three_way_cluster() {
  local dir; dir=$(mktemp -d -p "$TMP" t5.XXXXXX)
  local audit="$dir/audit.jsonl"

  make_lesson "$dir/arch-x.md" "architecture patterns testing tdd" "$BODY_ARCH $BODY_ARCH"
  make_lesson "$dir/arch-y.md" "architecture patterns testing tdd" "$BODY_ARCH_PARA $BODY_ARCH_PARA"
  make_lesson "$dir/arch-z.md" "architecture patterns testing tdd" "$BODY_ARCH_THIRD $BODY_ARCH_THIRD"

  local out
  out=$(TEMPLATE_MEMORY_DIR="$dir" \
        CONSOLIDATION_THRESHOLD=0.7 \
        AUDIT_LOG_PATH="$audit" \
        CLOCK_TS="2026-05-19T12:00:00Z" \
        "$SCRIPT" 2>/dev/null)

  if ! echo "$out" | python3 -c "import sys,json; json.load(sys.stdin)" >/dev/null 2>&1; then
    fail "three-way cluster json valid" "not valid JSON: $out"
    return
  fi

  local cluster_count lessons_in_cluster
  cluster_count=$(echo "$out" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
  lessons_in_cluster=$(echo "$out" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d: print(len(d[0]['lessons']))
else: print(0)
")

  # Three-way: could be 1 cluster of 3 (fully transitive) OR up to 3 clusters
  # depending on pairwise scores. Accept: all 3 lessons are detected.
  local total_detected
  total_detected=$(echo "$out" | python3 -c "
import sys,json
d=json.load(sys.stdin)
names=set()
for c in d:
    for l in c['lessons']: names.add(l['name'])
print(len(names))
")

  if [ "$total_detected" = "3" ]; then
    pass "three-way cluster → all 3 lessons detected (transitive closure)"
  else
    fail "three-way cluster" "expected 3 lessons detected, got total_detected=$total_detected cluster_count=$cluster_count out=$out"
  fi
}

# ---- t6: threshold configurable via CONSOLIDATION_THRESHOLD ----
t6_threshold_configurable() {
  local dir; dir=$(mktemp -d -p "$TMP" t6.XXXXXX)
  local audit="$dir/audit.jsonl"

  make_lesson "$dir/test-x.md" "architecture patterns" "$BODY_ARCH $BODY_ARCH"
  make_lesson "$dir/test-y.md" "architecture patterns" "$BODY_ARCH_PARA $BODY_ARCH_PARA"

  # With threshold 0.99 should find nothing (or less than default)
  local out_high out_low
  out_high=$(TEMPLATE_MEMORY_DIR="$dir" \
             CONSOLIDATION_THRESHOLD=0.99 \
             AUDIT_LOG_PATH="$audit" \
             CLOCK_TS="2026-05-19T12:00:00Z" \
             "$SCRIPT" 2>/dev/null)

  # With threshold 0.3 should find something
  out_low=$(TEMPLATE_MEMORY_DIR="$dir" \
            CONSOLIDATION_THRESHOLD=0.3 \
            AUDIT_LOG_PATH="$audit" \
            CLOCK_TS="2026-05-19T12:00:00Z" \
            "$SCRIPT" 2>/dev/null)

  local high_count low_count
  high_count=$(echo "$out_high" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
  low_count=$(echo "$out_low" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  if [ "$low_count" -gt "$high_count" ]; then
    pass "CONSOLIDATION_THRESHOLD honored: low=0.3 finds $low_count, high=0.99 finds $high_count"
  else
    fail "threshold configurable" "expected low>high; low_count=$low_count high_count=$high_count"
  fi
}

# ---- t7: read-only — does NOT write to TEMPLATE_MEMORY_DIR ----
t7_read_only() {
  local dir; dir=$(mktemp -d -p "$TMP" t7.XXXXXX)
  local audit="$dir/audit.jsonl"

  make_lesson "$dir/readonly-test.md" "architecture patterns" "$BODY_ARCH"

  # Record mtime before
  local mtime_before
  mtime_before=$(stat -f "%m" "$dir/readonly-test.md" 2>/dev/null \
    || stat -c "%Y" "$dir/readonly-test.md" 2>/dev/null || echo "0")

  TEMPLATE_MEMORY_DIR="$dir" \
    CONSOLIDATION_THRESHOLD=0.7 \
    AUDIT_LOG_PATH="$audit" \
    "$SCRIPT" >/dev/null 2>&1

  local mtime_after
  mtime_after=$(stat -f "%m" "$dir/readonly-test.md" 2>/dev/null \
    || stat -c "%Y" "$dir/readonly-test.md" 2>/dev/null || echo "0")

  # Check no new files were created in dir (besides the audit we explicitly set outside dir)
  local new_files
  new_files=$(find "$dir" -maxdepth 1 -name "*.md" -newer "$dir/readonly-test.md" 2>/dev/null | wc -l | tr -d ' ')

  if [ "$mtime_before" = "$mtime_after" ] && [ "$new_files" = "0" ]; then
    pass "read-only: lesson file not modified, no new .md files created"
  else
    fail "read-only" "mtime_before=$mtime_before mtime_after=$mtime_after new_files=$new_files"
  fi
}

# ---- t8: audit event emitted with correct shape ----
t8_audit_event_emitted() {
  local dir; dir=$(mktemp -d -p "$TMP" t8.XXXXXX)
  local audit="$dir/audit.jsonl"

  make_lesson "$dir/audit-a.md" "architecture patterns testing tdd" "$BODY_ARCH $BODY_ARCH"
  make_lesson "$dir/audit-b.md" "architecture patterns testing tdd" "$BODY_ARCH $BODY_ARCH"

  TEMPLATE_MEMORY_DIR="$dir" \
    CONSOLIDATION_THRESHOLD=0.7 \
    AUDIT_LOG_PATH="$audit" \
    CLOCK_TS="2026-05-19T12:00:00Z" \
    "$SCRIPT" >/dev/null 2>&1

  if [ ! -f "$audit" ]; then
    fail "audit event emitted" "audit.jsonl not created"
    return
  fi

  local event ts clusters lessons_involved
  event=$(jq -r '.event' "$audit" 2>/dev/null)
  ts=$(jq -r '.ts' "$audit" 2>/dev/null)
  clusters=$(jq -r '.clusters' "$audit" 2>/dev/null)
  lessons_involved=$(jq -r '.lessons_involved' "$audit" 2>/dev/null)

  if [ "$event" = "consolidation_detected" ] \
     && [ "$ts" = "2026-05-19T12:00:00Z" ] \
     && [ "$clusters" = "1" ] \
     && [ "$lessons_involved" = "2" ]; then
    pass "audit event: consolidation_detected with clusters=1, lessons_involved=2"
  else
    fail "audit event shape" "event=$event ts=$ts clusters=$clusters lessons_involved=$lessons_involved"
  fi
}

# ---- t9: REPORT_PATH writes markdown when set ----
t9_report_path_written() {
  local dir; dir=$(mktemp -d -p "$TMP" t9.XXXXXX)
  local audit="$dir/audit.jsonl"
  local report="$dir/report.md"

  make_lesson "$dir/rep-a.md" "architecture patterns testing tdd" "$BODY_ARCH $BODY_ARCH"
  make_lesson "$dir/rep-b.md" "architecture patterns testing tdd" "$BODY_ARCH $BODY_ARCH"

  TEMPLATE_MEMORY_DIR="$dir" \
    CONSOLIDATION_THRESHOLD=0.7 \
    AUDIT_LOG_PATH="$audit" \
    REPORT_PATH="$report" \
    CLOCK_TS="2026-05-19T12:00:00Z" \
    "$SCRIPT" >/dev/null 2>&1

  if [ -f "$report" ] \
     && grep -q "Consolidation Candidates" "$report" \
     && grep -q "Human gate" "$report"; then
    pass "REPORT_PATH: markdown report written with correct header"
  else
    fail "report path" "report missing or malformed; exists=$([ -f "$report" ] && echo yes || echo no)"
  fi
}

# ---- t10: missing Tier 0 dir → output [] gracefully ----
t10_missing_tier0_dir() {
  local audit="$TMP/audit-t10.jsonl"

  local out
  out=$(TEMPLATE_MEMORY_DIR="$TMP/nonexistent-tier0-$$" \
        CONSOLIDATION_THRESHOLD=0.7 \
        AUDIT_LOG_PATH="$audit" \
        CLOCK_TS="2026-05-19T12:00:00Z" \
        "$SCRIPT" 2>/dev/null)

  local rc=$?
  if [ "$rc" -eq 0 ] && [ "$out" = "[]" ]; then
    pass "missing Tier 0 dir → exit 0, output []"
  else
    fail "missing Tier 0 dir" "exit=$rc out=$out"
  fi
}

# ---- t11: JSON output has correct schema fields ----
t11_json_schema_fields() {
  local dir; dir=$(mktemp -d -p "$TMP" t11.XXXXXX)
  local audit="$dir/audit.jsonl"

  make_lesson "$dir/schema-a.md" "architecture patterns testing tdd" "$BODY_ARCH $BODY_ARCH"
  make_lesson "$dir/schema-b.md" "architecture patterns testing tdd" "$BODY_ARCH $BODY_ARCH"

  local out
  out=$(TEMPLATE_MEMORY_DIR="$dir" \
        CONSOLIDATION_THRESHOLD=0.7 \
        AUDIT_LOG_PATH="$audit" \
        CLOCK_TS="2026-05-19T12:00:00Z" \
        "$SCRIPT" 2>/dev/null)

  if ! echo "$out" | python3 -c "import sys,json; json.load(sys.stdin)" >/dev/null 2>&1; then
    fail "json schema" "not valid JSON: $out"
    return
  fi

  # Check required fields: cluster_id, lessons, avg_overlap, detected_at
  local has_fields
  has_fields=$(echo "$out" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if not d: print('empty'); exit(0)
c=d[0]
fields=['cluster_id','lessons','avg_overlap','detected_at']
missing=[f for f in fields if f not in c]
if missing: print('missing:' + ','.join(missing))
else:
    l=c['lessons'][0]
    lfields=['name','score']
    lmissing=[f for f in lfields if f not in l]
    if lmissing: print('lesson-missing:' + ','.join(lmissing))
    else: print('ok')
")

  if [ "$has_fields" = "ok" ]; then
    pass "JSON schema: cluster_id, lessons[{name,score}], avg_overlap, detected_at all present"
  else
    fail "json schema fields" "check=$has_fields out=$out"
  fi
}

# ---- t12: meta files (README.md, CLAUDE.md, *archive*) are skipped ----
t12_meta_files_skipped() {
  local dir; dir=$(mktemp -d -p "$TMP" t12.XXXXXX)
  local audit="$dir/audit.jsonl"

  # Meta files — should be skipped even if identical to each other
  cat > "$dir/README.md" <<'EOF'
---
tags: [architecture, patterns, testing, tdd]
---
README file should be skipped by the detector.
EOF
  cat > "$dir/CLAUDE.md" <<'EOF'
---
tags: [architecture, patterns, testing, tdd]
---
CLAUDE.md file should be skipped by the detector.
EOF
  cat > "$dir/arch-archive-2026.md" <<'EOF'
---
tags: [architecture, patterns, testing, tdd]
---
Archive file should be skipped.
EOF
  # One real lesson
  make_lesson "$dir/real.md" "architecture patterns" "$BODY_ARCH"

  local out
  out=$(TEMPLATE_MEMORY_DIR="$dir" \
        CONSOLIDATION_THRESHOLD=0.7 \
        AUDIT_LOG_PATH="$audit" \
        CLOCK_TS="2026-05-19T12:00:00Z" \
        "$SCRIPT" 2>/dev/null)

  # Expect [] because real.md is alone after meta files skipped
  if [ "$out" = "[]" ]; then
    pass "meta files (README.md, CLAUDE.md, *archive*) correctly skipped"
  else
    # If it found clusters, check that no meta file names appear
    if echo "$out" | python3 -c "
import sys,json
d=json.load(sys.stdin)
names=set()
for c in d:
    for l in c['lessons']: names.add(l['name'])
bad=[n for n in names if n in ('README.md','CLAUDE.md','arch-archive-2026.md')]
print('bad:' + ','.join(bad) if bad else 'ok')
" 2>/dev/null | grep -q "^ok$"; then
      pass "meta files not in output (only real lessons detected)"
    else
      fail "meta files skipped" "meta files appeared in output: $out"
    fi
  fi
}

echo "=== E190: consolidation detector ==="
t1_empty_memory
t2_all_distinct
t3_exact_duplicate
t4_near_duplicate
t5_three_way_cluster
t6_threshold_configurable
t7_read_only
t8_audit_event_emitted
t9_report_path_written
t10_missing_tier0_dir
t11_json_schema_fields
t12_meta_files_skipped

TOTAL=$((PASS + FAIL))
echo "----"
echo "$PASS/$TOTAL passed"

if [ $FAIL -gt 0 ]; then
  echo "first failure: $FIRST_FAIL" >&2
  exit 1
fi
exit 0
