#!/usr/bin/env bash
# E180 — Memory Retrieval Logging fixture tests.
#
# Verifies the three retrieval event types appear in .claude/audit.jsonl:
#   - tier0_loaded (session-start.sh — when NEW_PROJECT_PRIMER.md is injected)
#   - rule_fired   (stop-verifier.sh — when a rule trips)
#   - agent_cited  (subagent-stop-writeback.sh — when write-back doc cites a lesson)
#
# All tests run in isolated temp directories so the real repo's audit log is
# never polluted.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SESSION_START="$REPO_ROOT/scripts/hooks/session-start.sh"
STOP_VERIFIER="$REPO_ROOT/scripts/hooks/stop-verifier.sh"
SUBAGENT_HOOK="$REPO_ROOT/scripts/hooks/subagent-stop-writeback.sh"
RULE_MAP="$REPO_ROOT/scripts/hooks/rule-to-lesson.json"

for h in "$SESSION_START" "$STOP_VERIFIER" "$SUBAGENT_HOOK"; do
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

# ---- t1: rule-to-lesson.json is valid + has at least 5 mappings ----
t1_rule_map_valid() {
  if [ ! -f "$RULE_MAP" ]; then
    fail "rule-to-lesson.json exists" "missing at $RULE_MAP"
    return
  fi
  if ! jq -e '.' "$RULE_MAP" >/dev/null 2>&1; then
    fail "rule-to-lesson.json is valid JSON" "jq parse error"
    return
  fi
  # Count keys excluding any "_comment" metadata
  local count
  count=$(jq -r '[keys[] | select(test("^[0-9]+$"))] | length' "$RULE_MAP")
  if [ "$count" -ge 5 ]; then
    pass "rule-to-lesson.json has $count rule mappings (>= 5)"
  else
    fail "rule-to-lesson.json has >= 5 rule mappings" "only $count found"
  fi
}

# ---- t2: stop-verifier emits rule_fired when a rule trips ----
# NOTE (E-batch1 fix): this originally staged a `client/src/pages/foo/Foo.css`
# file to trip the old FastAPI/Vite-era "Rule 21" (design-system CSS rule).
# That rule — and the client/src/ tree itself — was removed with the E282
# migration to next-app/ (see scripts/hooks/CLAUDE.md, "Stop Verifier Rules").
# This was silently orphaned: the fixture staged a file that no rule scans
# anymore, so it always fell through to "no audit log written". Retargeted to
# trip the still-live Rule 4 (console.log in next-app runtime code), which
# also carries a rule-to-lesson.json mapping (anti-patterns.md).
t2_rule_fired_on_rule_4() {
  local cwd
  cwd=$(mktemp -d -p "$TMP" t2.XXXXXX)
  local audit="$cwd/audit.jsonl"
  (
    cd "$cwd"
    git init -q
    git config user.email test@test.example
    git config user.name Test
    git commit -q --allow-empty -m "init"
    # Rule 4 scans next-app/{app,components,lib,actions,hooks} directly on
    # disk (not the git diff) — no `git add` needed to trip it.
    mkdir -p next-app/lib
    echo 'console.log("debug")' > next-app/lib/foo.ts

    AUDIT_LOG_PATH="$audit" \
      RULE_TO_LESSON_PATH="$RULE_MAP" \
      bash "$STOP_VERIFIER" >/dev/null 2>&1
  )
  if [ ! -f "$audit" ]; then
    fail "rule_fired emitted on rule 4 trip" "no audit log written"
    return
  fi
  local hit
  hit=$(jq -c 'select(.event == "rule_fired" and (.rule_id|tostring) == "4")' "$audit" 2>/dev/null | tail -1)
  if [ -z "$hit" ]; then
    fail "rule_fired emitted on rule 4 trip" "no matching event in $audit"
    return
  fi
  local lesson severity
  lesson=$(echo "$hit" | jq -r .lesson)
  severity=$(echo "$hit" | jq -r .severity)
  if [ "$severity" = "block" ] && [ "$lesson" = "anti-patterns.md" ]; then
    pass "rule 4 -> rule_fired (severity=block, lesson=anti-patterns.md)"
  else
    fail "rule 4 -> rule_fired event" "severity=$severity lesson=$lesson hit=$hit"
  fi
}

# ---- t3: stop-verifier exits 0 (no rule_fired) when nothing trips ----
t3_no_rule_fired_on_clean_tree() {
  local cwd
  cwd=$(mktemp -d -p "$TMP" t3.XXXXXX)
  local audit="$cwd/audit.jsonl"
  (
    cd "$cwd"
    git init -q
    git config user.email test@test.example
    git config user.name Test
    git commit -q --allow-empty -m "init"

    AUDIT_LOG_PATH="$audit" \
      RULE_TO_LESSON_PATH="$RULE_MAP" \
      bash "$STOP_VERIFIER" >/dev/null 2>&1
  )
  # Audit log might not exist (no rule fired -> no append). Both no-file and
  # empty file are acceptable.
  local hits
  if [ -f "$audit" ]; then
    hits=$(jq -c 'select(.event == "rule_fired")' "$audit" 2>/dev/null | wc -l | tr -d ' ')
  else
    hits=0
  fi
  if [ "$hits" = "0" ]; then
    pass "clean working tree -> no rule_fired events"
  else
    fail "clean working tree -> no rule_fired events" "got $hits events"
  fi
}

# ---- t4: subagent-stop-writeback emits agent_cited when DOC cites a lesson ----
t4_agent_cited_on_lesson_reference() {
  local cwd
  cwd=$(mktemp -d -p "$TMP" t4.XXXXXX)
  local audit="$cwd/audit.jsonl"
  (
    cd "$cwd"
    # Hook cd's to git toplevel; fake it to stay here via shell function.
    mkdir -p docs/context
    # Pre-populate the @qa write-back with a Tier 0 reference. The hook
    # appends a `<!-- qa stopped at $TS -->` line and then scans the file
    # for `template-memory/<slug>.md` patterns.
    cat > docs/context/review-log.md <<'INNER'
## Review notes
Per `template-memory/workflow-patterns.md`, we always run /athena:qa
before committing. Also see `template-memory/anti-patterns.md` for the
console.log lesson.
INNER

    printf '{"agent_name":"qa"}' | \
      AUDIT_LOG_PATH="$audit" \
      bash -c '
        git() { if [ "$1" = "rev-parse" ]; then echo "."; return 0; fi; command git "$@"; }
        export -f git
        exec bash "'"$SUBAGENT_HOOK"'"
      '
  )
  if [ ! -f "$audit" ]; then
    fail "agent_cited emitted" "no audit log written"
    return
  fi
  local cited_count
  cited_count=$(jq -c 'select(.event == "agent_cited" and .agent == "qa")' "$audit" 2>/dev/null | wc -l | tr -d ' ')
  local lessons
  lessons=$(jq -r 'select(.event == "agent_cited") | .lesson' "$audit" 2>/dev/null | sort -u | tr '\n' ',' | sed 's/,$//')
  if [ "$cited_count" = "2" ] && echo "$lessons" | grep -q "anti-patterns.md" && echo "$lessons" | grep -q "workflow-patterns.md"; then
    pass "agent_cited emits one event per unique lesson (2 events: $lessons)"
  else
    fail "agent_cited emits one event per unique lesson" "count=$cited_count lessons=$lessons"
  fi
}

# ---- t5: subagent-stop-writeback emits no agent_cited when DOC has no refs ----
t5_no_agent_cited_when_no_refs() {
  local cwd
  cwd=$(mktemp -d -p "$TMP" t5.XXXXXX)
  local audit="$cwd/audit.jsonl"
  (
    cd "$cwd"
    mkdir -p docs/context
    echo "## Plain doc with no template-memory references." > docs/context/review-log.md

    printf '{"agent_name":"qa"}' | \
      AUDIT_LOG_PATH="$audit" \
      bash -c '
        git() { if [ "$1" = "rev-parse" ]; then echo "."; return 0; fi; command git "$@"; }
        export -f git
        exec bash "'"$SUBAGENT_HOOK"'"
      '
  )
  local cited_count
  if [ -f "$audit" ]; then
    cited_count=$(jq -c 'select(.event == "agent_cited")' "$audit" 2>/dev/null | wc -l | tr -d ' ')
  else
    cited_count=0
  fi
  if [ "$cited_count" = "0" ]; then
    pass "no template-memory refs -> no agent_cited events"
  else
    fail "no template-memory refs -> no agent_cited events" "got $cited_count"
  fi
}

# ---- t6: session-start.sh emits tier0_loaded when primer is read ----
t6_tier0_loaded_on_session_start() {
  local cwd
  cwd=$(mktemp -d -p "$TMP" t6.XXXXXX)
  local fake_home="$cwd/home"
  local audit="$cwd/audit.jsonl"
  mkdir -p "$fake_home/.claude/template-memory"
  echo "# Tier 0 primer" > "$fake_home/.claude/template-memory/NEW_PROJECT_PRIMER.md"

  (
    cd "$cwd"
    git init -q
    git config user.email test@test.example
    git config user.name Test
    git commit -q --allow-empty -m "init"

    HOME="$fake_home" AUDIT_LOG_PATH="$audit" \
      bash "$SESSION_START" >/dev/null 2>&1
  )
  if [ ! -f "$audit" ]; then
    fail "tier0_loaded emitted on session-start" "no audit log written"
    return
  fi
  local hit
  hit=$(jq -c 'select(.event == "tier0_loaded")' "$audit" 2>/dev/null | tail -1)
  if [ -z "$hit" ]; then
    fail "tier0_loaded emitted on session-start" "no matching event"
    return
  fi
  local lesson
  lesson=$(echo "$hit" | jq -r .lesson)
  if [ "$lesson" = "NEW_PROJECT_PRIMER.md" ]; then
    pass "tier0_loaded emitted with lesson=NEW_PROJECT_PRIMER.md"
  else
    fail "tier0_loaded emitted with lesson=NEW_PROJECT_PRIMER.md" "lesson=$lesson hit=$hit"
  fi
}

# ---- t7: session-start does NOT emit tier0_loaded when primer is missing ----
t7_no_tier0_loaded_when_primer_missing() {
  local cwd
  cwd=$(mktemp -d -p "$TMP" t7.XXXXXX)
  local fake_home="$cwd/home"
  local audit="$cwd/audit.jsonl"
  mkdir -p "$fake_home/.claude"  # no template-memory dir

  (
    cd "$cwd"
    git init -q
    git config user.email test@test.example
    git config user.name Test
    git commit -q --allow-empty -m "init"

    HOME="$fake_home" AUDIT_LOG_PATH="$audit" \
      bash "$SESSION_START" >/dev/null 2>&1
  )
  local hits
  if [ -f "$audit" ]; then
    hits=$(jq -c 'select(.event == "tier0_loaded")' "$audit" 2>/dev/null | wc -l | tr -d ' ')
  else
    hits=0
  fi
  if [ "$hits" = "0" ]; then
    pass "missing primer -> no tier0_loaded event"
  else
    fail "missing primer -> no tier0_loaded event" "got $hits"
  fi
}

# ---- t8: rule_fired carries empty lesson when rule has no mapping ----
# (See t2's note — retargeted from the removed "Rule 21" to the still-live
# Rule 4, using a stub map that deliberately omits it.)
t8_rule_fired_unmapped_rule() {
  local cwd
  cwd=$(mktemp -d -p "$TMP" t8.XXXXXX)
  local audit="$cwd/audit.jsonl"
  # Map only rule 99 — none of the real rules.
  local stub_map="$cwd/stub-map.json"
  echo '{"99":"phantom.md"}' > "$stub_map"
  (
    cd "$cwd"
    git init -q
    git config user.email test@test.example
    git config user.name Test
    git commit -q --allow-empty -m "init"
    mkdir -p next-app/lib
    echo 'console.log("debug")' > next-app/lib/foo.ts

    AUDIT_LOG_PATH="$audit" \
      RULE_TO_LESSON_PATH="$stub_map" \
      bash "$STOP_VERIFIER" >/dev/null 2>&1
  )
  if [ ! -f "$audit" ]; then
    fail "rule_fired with empty lesson when unmapped" "no audit log"
    return
  fi
  local hit
  hit=$(jq -c 'select(.event == "rule_fired" and (.rule_id|tostring) == "4")' "$audit" 2>/dev/null | tail -1)
  if [ -z "$hit" ]; then
    fail "rule_fired with empty lesson when unmapped" "no rule 4 event"
    return
  fi
  local lesson
  lesson=$(echo "$hit" | jq -r .lesson)
  if [ "$lesson" = "" ]; then
    pass "unmapped rule -> rule_fired with empty lesson"
  else
    fail "unmapped rule -> rule_fired with empty lesson" "got lesson=$lesson"
  fi
}

# ---- t9: all three event types reachable in one log ----
t9_all_three_event_types_in_log() {
  local cwd
  cwd=$(mktemp -d -p "$TMP" t9.XXXXXX)
  local fake_home="$cwd/home"
  local audit="$cwd/audit.jsonl"
  mkdir -p "$fake_home/.claude/template-memory"
  echo "# primer" > "$fake_home/.claude/template-memory/NEW_PROJECT_PRIMER.md"

  # 1) Trigger tier0_loaded via session-start
  (
    cd "$cwd"
    git init -q
    git config user.email test@test.example
    git config user.name Test
    git commit -q --allow-empty -m "init"
    HOME="$fake_home" AUDIT_LOG_PATH="$audit" \
      bash "$SESSION_START" >/dev/null 2>&1
  )
  # 2) Trigger rule_fired via stop-verifier (rule 4 — see t2's note on why
  #    this no longer uses the removed "rule 21")
  (
    cd "$cwd"
    mkdir -p next-app/lib
    echo 'console.log("debug")' > next-app/lib/foo.ts
    AUDIT_LOG_PATH="$audit" RULE_TO_LESSON_PATH="$RULE_MAP" \
      bash "$STOP_VERIFIER" >/dev/null 2>&1 || true
  )
  # 3) Trigger agent_cited via subagent-stop-writeback
  (
    cd "$cwd"
    mkdir -p docs/context
    echo "See template-memory/anti-patterns.md" > docs/context/review-log.md
    printf '{"agent_name":"qa"}' | \
      AUDIT_LOG_PATH="$audit" bash -c '
        git() { if [ "$1" = "rev-parse" ]; then echo "."; return 0; fi; command git "$@"; }
        export -f git
        exec bash "'"$SUBAGENT_HOOK"'"
      '
  )

  local types
  types=$(jq -r '.event' "$audit" 2>/dev/null | sort -u | tr '\n' ',' | sed 's/,$//')
  if echo "$types" | grep -q "tier0_loaded" \
    && echo "$types" | grep -q "rule_fired" \
    && echo "$types" | grep -q "agent_cited"; then
    pass "all three E180 event types appear in audit.jsonl ($types)"
  else
    fail "all three E180 event types appear in audit.jsonl" "got: $types"
  fi
}

# Run
t1_rule_map_valid
t2_rule_fired_on_rule_4
t3_no_rule_fired_on_clean_tree
t4_agent_cited_on_lesson_reference
t5_no_agent_cited_when_no_refs
t6_tier0_loaded_on_session_start
t7_no_tier0_loaded_when_primer_missing
t8_rule_fired_unmapped_rule
t9_all_three_event_types_in_log

TOTAL=$((PASS + FAIL))
echo "----"
echo "$PASS/$TOTAL passed"

if [ $FAIL -gt 0 ]; then
  echo "first failure: $FIRST_FAIL" >&2
  exit 1
fi
exit 0
